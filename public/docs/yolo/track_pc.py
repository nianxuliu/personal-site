import cv2
import numpy as np
import time
from ultralytics import YOLO
"""
测试步骤:
创建虚拟环境: python -m venv venv
激活虚拟环境: .venv\Scripts\activate
安装依赖: pip install opencv-contrib-python ultralytics numpy
运行程序: python track.py
请用纸团和瓶子进行测试，屏幕上会显示追踪到的目标以及预测的400ms后它的位置。
控制台会给出四个麦轮的转动方向、速度和时间指令。
按q退出程序。
若要修改模型，请替换 'best.pt' 文件路径(第26行和288行)并修改 TARGET_CLASS_ID 变量(第42行)。
画面中的蓝色框表示检测到的动态物体，绿色框才表示进入追踪状态的目标，白色的点表示预测的位置。
"""
class HybridTracker:
    """
    一个完全封装的、带状态机的智能追踪器。
    - 使用稠密光流+YOLO进行目标确认。
    - 使用CSRT进行预测性追踪，并通过YOLO周期性再确认。
    - 通过边界检查、静止检测和视觉丢失容忍来判断追踪失败。
    - 内部处理所有控制逻辑，包括带智能记忆的惯性航行。
    - 对外只提供一个 process_frame 接口，始终返回当前最合理的电机指令。
    """
    def __init__(self, model_path='best.pt'):
        """
        初始化追踪器，加载模型和摄像头，设置所有核心参数。
        :param model_path: YOLO模型的路径。
        """
        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened(): print("错误：找不到摄像头"); raise SystemExit
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.frame_width, self.frame_height = 640, 480
        self.frame_center_x, self.frame_center_y = self.frame_width // 2, self.frame_height // 2
        try:
            self.yolo_model = YOLO(model_path)
            print(f"YOLO模型 '{model_path}' 加载成功。"); print("模型可识别类别:", self.yolo_model.names)
        except Exception as e:
            print(f"错误: 加载YOLO模型失败: {e}"); raise SystemExit
        self.TARGET_CLASS_ID = 1
        self.CONFIDENCE_THRESHOLD = 0.25
        self.tracker, self.tracking, self.bbox = None, False, None
        self.MIN_TARGET_AREA, self.MAX_TARGET_AREA = 500, 25000
        self.MOTION_DETECTION_THRESHOLD = 4.0
        self.STATIC_FRAMES_TOLERANCE, self.STATIC_PIXEL_TOLERANCE = 5, 2
        self.TRACKING_LOSS_TOLERANCE = 10
        self.last_bbox_center, self.static_frames_count, self.lost_frames_count = None, 0, 0
        self.prev_gray = None
        self.last_center, self.last_time = None, None
        self.pixel_velocity, self.velocity_smoothing_factor = (0, 0), 0.7
        self.prediction_time_ms = 400
        self.COASTING_DURATION = 0.5
        self.dead_zone_radius = 15
        self.is_coasting = False
        self.coasting_end_time = 0.0
        self.last_motion_control_map = {}
        
        # --- 【新增】用于YOLO再确认的变量 ---
        self.reconfirm_frame_count = 0
        self.RECONFIRM_INTERVAL = 10 # 每10帧进行一次YOLO再确认

    def cleanup(self):
        """
        释放摄像头资源。
        """
        self.cap.release()
        cv2.destroyAllWindows()

    def _update_velocity(self, current_center):
        """
        根据连续帧的中心点变化，计算并平滑目标的速度向量。
        :param current_center: 目标当前的中心点坐标。
        """
        current_time = time.time()
        vx, vy = 0, 0
        if self.last_center is not None and self.last_time is not None:
            dt = current_time - self.last_time
            if dt > 1e-6:
                vx = (current_center[0] - self.last_center[0]) / dt
                vy = (current_center[1] - self.last_center[1]) / dt
        s = self.velocity_smoothing_factor
        self.pixel_velocity = (self.pixel_velocity[0] * s + vx * (1 - s), self.pixel_velocity[1] * s + vy * (1 - s))
        self.last_center, self.last_time = current_center, current_time

    def _track_target(self, frame):
        """
        当处于追踪状态时，调用此函数。
        使用CSRT追踪器更新目标位置，并执行多种理智检查（视觉丢失、边界碰撞、静止、YOLO再确认）。
        :param frame: 当前的彩色视频帧。
        :return: (bool: 是否成功, tuple: 中心点, tuple: 边界框)
        """
        success, bbox = self.tracker.update(frame)

        if not success:
            self.lost_frames_count += 1
            if self.lost_frames_count > self.TRACKING_LOSS_TOLERANCE:
                self._reset_tracker()
                return False, (0,0), None
            else:
                return False, (0,0), self.bbox
        
        self.lost_frames_count = 0
        x, y, w, h = map(int, bbox)
        frame_height, frame_width, _ = frame.shape
        
        sane = True
        if w <= 0 or h <= 0 or x <= 2 or y <= 2 or (x + w) >= frame_width - 2 or (y + h) >= frame_height - 2: 
            sane = False
        current_center = (x + w // 2, y + h // 2)
        if self.last_bbox_center is not None:
            dist = np.sqrt((current_center[0] - self.last_bbox_center[0])**2 + (current_center[1] - self.last_bbox_center[1])**2)
            if dist < self.STATIC_PIXEL_TOLERANCE: self.static_frames_count += 1
            else: self.static_frames_count = 0
        self.last_bbox_center = current_center
        if self.static_frames_count > self.STATIC_FRAMES_TOLERANCE:
            print("\n检测到追踪框静止，判定为目标丢失...")
            sane = False
        
        # --- 周期性的YOLO再确认 ---
        self.reconfirm_frame_count += 1
        if sane and self.reconfirm_frame_count >= self.RECONFIRM_INTERVAL:
            self.reconfirm_frame_count = 0 # 重置计数器
            roi = frame[y:y+h, x:x+w]
            if roi.size > 0:
                results = self.yolo_model(roi, verbose=False)
                is_still_target = any(int(box.cls) == self.TARGET_CLASS_ID and box.conf > self.CONFIDENCE_THRESHOLD for result in results for box in result.boxes)
                if not is_still_target:
                    print(f"\nYOLO再确认失败！追踪器可能已粘滞。")
                    sane = False

        if sane:
            self.bbox = (x, y, w, h)
            center = (x + w // 2, y + h // 2)
            return True, center, self.bbox
        else:
            self._reset_tracker()
            return False, (0,0), None

    def _detect_new_target(self, frame, frame_gray):
        """
        当处于搜索状态时，调用此函数。
        使用稠密光流发现运动，并用YOLO确认运动物体是否为目标。
        :param frame: 当前的彩色视频帧。
        :param frame_gray: 当前的灰度视频帧。
        :return: (bool: 是否成功, tuple: 中心点, tuple: 边界框)
        """
        flow = cv2.calcOpticalFlowFarneback(self.prev_gray, frame_gray, None, 0.5, 3, 15, 3, 5, 1.2, 0)
        magnitude, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
        motion_mask = (magnitude > self.MOTION_DETECTION_THRESHOLD).astype(np.uint8) * 255
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        motion_mask = cv2.morphologyEx(motion_mask, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(motion_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        detection_bbox_for_debug = None
        if not contours: return False, (0,0), None, motion_mask, detection_bbox_for_debug
        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)
        x, y, w, h = cv2.boundingRect(largest_contour)
        detection_bbox_for_debug = (x, y, w, h)
        if self.MIN_TARGET_AREA < area < self.MAX_TARGET_AREA:
            roi = frame[y:y+h, x:x+w]
            if roi.size == 0: return False, (0,0), None, motion_mask, detection_bbox_for_debug
            results = self.yolo_model(roi, verbose=False)
            is_target_confirmed = any(int(box.cls) == self.TARGET_CLASS_ID and box.conf > self.CONFIDENCE_THRESHOLD for result in results for box in result.boxes)
            if is_target_confirmed:
                print("\n--- YOLO确认到目标 ---")
                self._initialize_tracker(frame, (x, y, w, h))
                center = (x + w // 2, y + h // 2)
                return True, center, self.bbox, motion_mask, detection_bbox_for_debug
        return False, (0,0), None, motion_mask, detection_bbox_for_debug

    def _initialize_tracker(self, frame, bbox):
        """
        初始化CSRT追踪器并重置所有相关状态变量。
        :param frame: 用于初始化的帧。
        :param bbox: 目标的初始边界框。
        """
        self.tracker = cv2.TrackerCSRT_create()
        self.tracker.init(frame, bbox)
        self.bbox, self.tracking = bbox, True
        center = (bbox[0] + bbox[2] // 2, bbox[1] + bbox[3] // 2)
        self.last_bbox_center = center
        self.last_center, self.last_time = center, time.time()
        self.pixel_velocity = (0, 0); self.static_frames_count = 0; self.lost_frames_count = 0
        self.reconfirm_frame_count = 0 

    def _reset_tracker(self):
        """
        重置追踪状态，清空所有追踪相关变量。
        """
        self.tracking, self.tracker, self.bbox, self.last_bbox_center = False, None, None, None
        self.static_frames_count = 0; self.pixel_velocity = (0, 0); self.lost_frames_count = 0

    def _calculate_mecanum_control(self, predicted_center):
        """
        计算四个麦轮的控制命令
        所有返回的数字都是标准的Python int类型。
        """
        dx = predicted_center[0] - self.frame_center_x
        dy = predicted_center[1] - self.frame_center_y

        if np.sqrt(dx**2 + dy**2) < self.dead_zone_radius:
            return {i: [0, 0, 40] for i in range(4)}

        Kp_translation, Kp_rotation = 0.4, 0.3
        vx, vy, v_rot = dy * Kp_translation, dx * Kp_translation, dx * Kp_rotation
        motor_speeds = [vx - vy - v_rot, vx + vy + v_rot, vx + vy - v_rot, vx - vy + v_rot]

        max_possible_speed = np.sqrt(self.frame_center_x**2 + self.frame_center_y**2) * Kp_translation
    
        control_map = {}
        COMMAND_DURATION_MS = 40
        for i in range(4):
            speed_percent_float = (motor_speeds[i] / max_possible_speed) * 100
            speed_percent_clipped = np.clip(speed_percent_float, -100, 100)

            action = 0 if speed_percent_clipped >= 0 else 1
            final_speed = int(abs(speed_percent_clipped)) 
        
            if final_speed < 5: 
                final_speed = 0
            
            control_map[i] = [int(action), int(final_speed), int(COMMAND_DURATION_MS)]
        
        return control_map

    def _is_motion_command(self, control_map):
        """
        辅助函数，判断一个控制指令是否包含实际运动。
        :param control_map: 电机指令字典。
        :return: bool
        """
        if not control_map: return False
        return any(control_map[motor_id][1] > 0 for motor_id in control_map)

    def process_frame(self, frame):
        """
        唯一的对外接口。处理一帧图像，并返回最终的电机控制指令。
        内部自动处理追踪、丢失和带智能记忆的惯性航行。
        :param frame: 从摄像头读取的原始视频帧。
        :return: 一个电机控制指令字典，如果无操作则为空字典。
        """
        was_tracking_before_this_frame = self.tracking
        if self.prev_gray is None:
            self.prev_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            return {}, False, None, None, None, None, None, False
        frame_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        detected, center, bbox = False, None, None
        motion_mask, detection_bbox, predicted_center = None, None, None
        if self.tracking:
            detected, center, bbox = self._track_target(frame)
        else:
            detected, center, bbox, motion_mask, detection_bbox = self._detect_new_target(frame, frame_gray)
        final_control_map = {}
        if detected:
            if self.is_coasting: print("\n航行中重新捕获目标！恢复精确追踪。")
            self.is_coasting = False
            self._update_velocity(center)
            vx_pix, vy_pix = self.pixel_velocity
            pred_time_sec = self.prediction_time_ms / 1000.0
            predicted_center = (int(center[0] + vx_pix * pred_time_sec), int(center[1] + vy_pix * pred_time_sec))
            current_control_map = self._calculate_mecanum_control(predicted_center)
            final_control_map = current_control_map
            if self._is_motion_command(current_control_map):
                self.last_motion_control_map = current_control_map
        else:
            if was_tracking_before_this_frame and not self.is_coasting:
                self.is_coasting = True
                self.coasting_end_time = time.time() + self.COASTING_DURATION
                print(f"\n视觉丢失！进入惯性航行，持续 {self.COASTING_DURATION} 秒...")
            if self.is_coasting:
                if time.time() < self.coasting_end_time:
                    final_control_map = self.last_motion_control_map
                else:
                    print("\n航行结束，目标未找回。停止电机。")
                    self.is_coasting = False
                    self.last_motion_control_map = {}
            else:
                final_control_map = {}
        self.prev_gray = frame_gray.copy()
        return final_control_map, detected, bbox, center, predicted_center, motion_mask, detection_bbox, self.is_coasting

def main():
    """
    主函数，初始化追踪器并处理视频流。
    """
    tracker = HybridTracker(model_path='best.pt')
    try:
        while True:
            ret, frame = tracker.cap.read()
            if not ret: print("无法读取视频帧，可能摄像头已断开。"); break
            final_control_map, detected, bbox, center, predicted_center, motion_mask, detection_bbox, is_coasting = tracker.process_frame(frame)
            if detected: print(f"追踪中... 指令: {final_control_map}", end='\r')
            elif is_coasting: print(f"惯性航行中... 指令: {final_control_map}", end='\r')
            else: print("正在搜索目标...                        ", end='\r')
            if detected and bbox:
                x, y, w, h = bbox
                cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
                cv2.circle(frame, center, 5, (0, 0, 255), -1)
                if predicted_center:
                    cv2.circle(frame, predicted_center, 7, (255, 255, 255), -1)
                    cv2.line(frame, center, predicted_center, (255, 255, 0), 2)
            elif is_coasting:
                cv2.putText(frame, "COASTING...", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
            elif detection_bbox:
                x, y, w, h = detection_bbox
                cv2.rectangle(frame, (x, y), (x + w, y + h), (255, 0, 0), 2)
                cv2.putText(frame, "Motion Detected", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)
            cv2.line(frame, (tracker.frame_center_x - 20, tracker.frame_center_y), (tracker.frame_center_x + 20, tracker.frame_center_y), (255, 0, 255), 2)
            cv2.line(frame, (tracker.frame_center_x, tracker.frame_center_y - 20), (tracker.frame_center_x, tracker.frame_center_y + 20), (255, 0, 255), 2)
            cv2.imshow('Hybrid Tracker - Debug Mode', frame)
            if motion_mask is not None:
                cv2.imshow('Motion Mask (Debug)', motion_mask)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                print("\n程序被用户中断。"); break
    except KeyboardInterrupt:
        print("\n程序被用户中断。")
    finally:
        tracker.cleanup()

if __name__ == '__main__':
    main()