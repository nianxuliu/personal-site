#!/usr/bin/python3
# -*- coding: utf-8 -*-

import YanAPI # type: ignore
import time
import math
import socket

class FallDownException(Exception):
    """自定义异常，用于表示机器人摔倒事件。"""
    pass

# ------------------- 比赛配置 -------------------
SKIP_MISSION_2 = True # True 表示跳过任务二
HURDLE_POSITION = "CENTER" # 根据任务卡修改，可选值: "LEFT", "CENTER", "RIGHT"
USE_MOCK_COMMANDS = True # True = 立即使用模拟指令；False = 等待网络指令
FACE_NAMES_FOR_MISSION = ["张三", "李四", "王五"]
# ----------------------------------------------

class IrosRoboMission:
    def __init__(self):
        print("--- 正在初始化并连接机器人 ---")
        self.is_connected = False
        
        # --- 航向与容差配置 ---
        self.target_heading = 0.0 # 目标航向，初始为0度
        self.initial_yaw_offset = 0.0 # 初始偏移量
        self.TOLERANCE_DEGREES = 6.0 # <--- 航向容差
        self.FINE_TUNE_THRESHOLD = 30.0 # <--- 粗调与微调的切换阈值
        self.FALL_DOWN_THRESHOLD = 70.0 # 摔倒检测阈值
        self.standing_euler_x = 0.0
        self.standing_euler_y = 0.0
        
        self.BASKET_DATA = {
            "红色": {"description": "红色物块"},
            "绿色": {"description": "绿色物块"},
            "蓝色": {"description": "蓝色物块"}
        }
        self.VALID_BLOCK_COLORS = ["红色", "绿色", "蓝色"] # <-- 【新增】颜色白名单
        self.APRILTAG_SIZE_M = 0.05
        self.dynamic_color_map = {
            "红色": 1,
            "绿色": 2,
            "蓝色": 3
        }

        try:
            YanAPI.yan_api_init("127.0.0.1")
            print("YanAPI 初始化完成！")
            self._safe_clear_vision()
            # self._start_vision_stream_for_referee()
            
            try:
                print("正在开启“摔倒后自动爬起”功能...")
                response = YanAPI.set_robot_fall_management_state(enable=True)
                if response and response['code'] == 0:
                    print("  - 功能开启成功！")
                else:
                    print("  - 警告: 功能开启失败: {}".format(response))
            except Exception as e:
                print("  - 警告: 在执行辅助初始化时发生错误: {}".format(e))

            time.sleep(1)
            self.is_connected = True
            self.calibrate_initial_heading()

        except Exception as e:
            print(" 严重错误: 核心初始化失败: {}".format(e))
            self.is_connected = False

    def _get_raw_yaw(self):
        try:
            gyro_data = YanAPI.get_sensors_gyro()
            if gyro_data and gyro_data['code'] == 0:
                if gyro_data['data'].get('gyro'):
                    return gyro_data['data']['gyro'][0]['euler-z']
        except Exception as e:
            print("读取陀螺仪原始数据失败: {}".format(e))
        return self.initial_yaw_offset + self.target_heading

    def get_current_heading(self):
        raw_yaw = self._get_raw_yaw()
        heading = raw_yaw - self.initial_yaw_offset
        
        while heading > 180:
            heading -= 360
        while heading <= -180:
            heading += 360
        return heading

    def calibrate_initial_heading(self):
        print("\n--- 正在校准初始航向 (设定当前方向为 0 度) ---")
        time.sleep(1) 
        try:
            gyro_data = YanAPI.get_sensors_gyro()
            if gyro_data and gyro_data['code'] == 0 and gyro_data['data'].get('gyro'):
                # 记录Z轴用于航向
                self.initial_yaw_offset = gyro_data['data']['gyro'][0]['euler-z']
                # 【核心修正】记录X和Y轴作为“正常站立”的基准
                self.standing_euler_x = gyro_data['data']['gyro'][0]['euler-x']
                self.standing_euler_y = gyro_data['data']['gyro'][0]['euler-y']
                
                print("  - 初始陀螺仪读数 (X, Y, Z): ({:.2f}, {:.2f}, {:.2f})".format(self.standing_euler_x, self.standing_euler_y, self.initial_yaw_offset))
                print("  - 正常站立姿态基准已记录。")
            else:
                self.initial_yaw_offset = self._get_raw_yaw()
        except Exception as e:
            print("  - 警告: 校准时读取陀螺仪失败: {}".format(e))
            self.initial_yaw_offset = 0.0
        self.target_heading = 0.0
        print("  - 目标航向已重置为: {:.2f} 度".format(self.target_heading))


    def _execute_motion(self, name, repeat=1, direction="", description="", speed="slow", silent_tts=False):
        """
        【带摔倒监控的异步执行版】
        下达动作指令后，进入监控循环，如果摔倒则抛出异常。
        """
        print("\n- [执行动作] {}".format(description))
        
        if not silent_tts:
            YanAPI.sync_do_tts(description)
        
        # 1. 异步下达动作指令
        response = YanAPI.start_play_motion(name=name, repeat=repeat, direction=direction, speed=speed)
        if not (response and response['code'] == 0):
            print("  - [错误!] 动作 '{}' 启动失败！".format(name))
            raise Exception("动作启动失败")

        print("  - 动作 '{}' 已启动，进入监控...".format(name))
        
        # 2. 进入监控循环
        start_time = time.time()
        timeout = 1000 # 动作超时时间

        while time.time() - start_time < timeout:
            # a. 检查是否摔倒
            if self.is_fallen():
                print("\n 检测到摔倒！正在中断当前动作... ")
                YanAPI.stop_play_motion()
                raise FallDownException("机器人摔倒") # 抛出自定义异常

            # b. 检查动作是否正常完成
            state = YanAPI.get_current_motion_play_state()
            if state and state['code'] == 0 and state['data']['status'] == 'idle':
                print("  - [成功] '{}' 已完成。".format(description))
                return True

            time.sleep(0.5)

        # c. 如果超时
        print("  - [错误!] 动作 '{}' 执行超时！".format(name))
        YanAPI.stop_play_motion()
        raise Exception("动作执行超时")

    def turn(self, target_angle, with_grab=False, description=""):
        self.target_heading = target_angle
        while self.target_heading > 180:
            self.target_heading -= 360
        while self.target_heading <= -180:
            self.target_heading += 360

        print("\n--- [开始智能转向], 目标: {:.2f} 度 ---".format(self.target_heading))
        
        max_attempts = 40
        for i in range(max_attempts):
            current_heading = self.get_current_heading()
            error = self.target_heading - current_heading
            
            while error > 180:
                error -= 360
            while error <= -180:
                error += 360

            print("  - 尝试 {}/{}: 目标 {:.2f}, 当前 {:.2f}, 误差 {:.2f}".format(i+1, max_attempts, self.target_heading, current_heading, error))

            # 1. 检查是否已经完成转向
            if abs(error) <= self.TOLERANCE_DEGREES:
                print("  -  成功转向到目标角度！航向在容差范围内。")
                return True
            
            # 2. 【核心逻辑】根据误差大小，判断是粗调还是微调
            is_large_turn = abs(error) > self.FINE_TUNE_THRESHOLD

            # 3. 根据误差方向、是否持物、以及是否粗调，来决定并执行最终的动作
            if error > 0: # 目标在当前航向的逆时针方向，需要左转
                if with_grab:
                    action_name = "左转抓1" if is_large_turn else "min左转_抓"
                    self._execute_motion(name=action_name, repeat=1, description="持物左转", silent_tts=True)
                else: # 不持物
                    if is_large_turn:
                        print("  - [粗调模式] 使用官方API 'turn around' 左转。")
                        self._execute_motion(name="turn around", direction="left", repeat=1, description="API左转", silent_tts=True)
                    else:
                        print("  - [微调模式] 使用自定义 '左转'。")
                        self._execute_motion(name="min左转", repeat=1, description="微调左转", silent_tts=True)

            else: # 误差 <= 0，目标在当前航向的顺时针方向，需要右转
                if with_grab:
                    action_name = "右转抓" if is_large_turn else "min右转_抓"
                    self._execute_motion(name=action_name, repeat=1, description="持物右转", silent_tts=True)
                else: # 不持物
                    if is_large_turn:
                        print("  - [粗调模式] 使用官方API 'turn around' 右转。")
                        self._execute_motion(name="turn around", direction="right", repeat=1, description="API右转", silent_tts=True)
                    else:
                        print("  - [微调模式] 使用自定义 '右转'。")
                        self._execute_motion(name="min右转", repeat=1, description="微调右转", silent_tts=True)
        print("  -  转向失败：超过最大尝试次数 {}。".format(max_attempts))
        return False
        
    def turn_relative(self, relative_angle, with_grab=False, description=""):
        new_target = self.target_heading + relative_angle
        return self.turn(new_target, with_grab, description)

    def correct_heading(self, with_grab=False):
        print("\n--- [开始航向校准], 目标朝向: {:.2f} 度 ---".format(self.target_heading))
        return self.turn(self.target_heading, with_grab=with_grab)
    
    def _set_head_angle(self, angle, runtime=500):
        print("  - 转动头部至角度: {}".format(angle))
        YanAPI.set_servos_angles(angles={"NeckLR": angle}, runtime=runtime)
        time.sleep(runtime / 1000.0 + 0.2)

    def _scan_for_baskets(self):
        """
        【最终物理排序推算版】扫描函数：
        1. 通过转头找到所有标签。
        2. 以最近（Z最小）标签的深度为基准深度。
        3. 以x绝对值最小的标签的水平位置为基准水平，再根据它看到的左右顺序建立模型算出距离。
        4. 结合物理顺序和30cm间距，重建完美地图。
        5. (新) 将理论地图与实际观测值进行加权平均，得到最终结果。
        """
        print("\n--- [开始头部扫描 - 物理排序推算融合模式] ---")
        
        raw_measurements = {}
        scan_angles = [60,90,120]
        
        try:
            tags_to_detect = [{"id": tag_id, "size": self.APRILTAG_SIZE_M} for tag_id in [1, 2, 3]]
            YanAPI.start_aprilTag_recognition(tags=tags_to_detect)
            time.sleep(0.5)

            for angle_deg in scan_angles:
                self._set_head_angle(angle_deg)
                time.sleep(1.0) # 等待视觉稳定
                status = YanAPI.get_aprilTag_recognition_status()
                if status and status['code'] == 0 and status['data'].get('AprilTagStatus'):
                    for tag in status['data']['AprilTagStatus']:
                        tag_id = tag['id']
                        if tag_id not in raw_measurements:
                            cam_x, cam_z = tag['position-x'], tag['position-z']
                            head_angle_rad = math.radians(angle_deg - 90)
                            body_x = cam_x * math.cos(-head_angle_rad) - cam_z * math.sin(-head_angle_rad)
                            body_z = cam_x * math.sin(-head_angle_rad) + cam_z * math.cos(-head_angle_rad)
                            raw_measurements[tag_id] = {'x': body_x, 'z': body_z}
                            print("  - 发现 ID: {}, 初步坐标(X,Z): ({:.3f}, {:.3f})".format(tag_id, body_x, body_z))

            self._set_head_angle(90)
        finally:
            YanAPI.stop_aprilTag_recognition()

        if not raw_measurements:
            print("  - ❌ 扫描失败：未能看到任何置物筐标签。")
            return {}
            
        print("\n  - [初步扫描结果]: 共看到 {} 个标签。".format(len(raw_measurements)))
        
        # --- 阶段二：物理模型重建 ---
        print("\n  - [阶段二: 物理模型重建] ...")
        # (此部分与原版相同：计算理论值)
        base_z_tag_id = min(raw_measurements, key=lambda id: raw_measurements[id]['z'])
        base_z_value = raw_measurements[base_z_tag_id]['z']
        print("  - (深度基准) 选择 ID:{} 的深度作为基准深度: {:.3f}".format(base_z_tag_id, base_z_value))

        sorted_by_x = sorted(raw_measurements.items(), key=lambda item: item[1]['x'])
        sorted_ids = [item[0] for item in sorted_by_x]
        print("  - (物理顺序) 从左到右依次为: {}".format(sorted_ids))

        horizontal_anchor_id, horizontal_anchor_pos = min(raw_measurements.items(), key=lambda item: abs(item[1]['x']))
        print("  - (水平基准) 选择X绝对值最小的标签 ID:{} 作为水平基准，其X坐标为: {:.3f}".format(horizontal_anchor_id, horizontal_anchor_pos['x']))

        basket_spacing = 0.25
        anchor_index_in_sorted_list = sorted_ids.index(horizontal_anchor_id)
        leftmost_x = horizontal_anchor_pos['x'] - anchor_index_in_sorted_list * basket_spacing

        predicted_map = {}
        for i, tag_id in enumerate(sorted_ids):
            predicted_map[tag_id] = {
                'x': leftmost_x + i * basket_spacing,
                'z': base_z_value
            }

        # --- 阶段三：融合观测与推算 (新增逻辑) ---
        print("\n  - [阶段三: 融合观测值与理论值] ...")
        prediction_weight = 0.6  # 理论模型的可信度权重 (可调参数)
        observation_weight = 1.0 - prediction_weight
        print("  - 融合权重: 理论模型={:.0f}%, 实际观测={:.0f}%".format(
            prediction_weight*100,
            observation_weight*100
        ))

        final_map = {}
        for tag_id in sorted_ids:
            observed_pos = raw_measurements[tag_id]
            predicted_pos = predicted_map[tag_id]
            
            # 对X和Z坐标分别进行加权平均
            final_x = (predicted_pos['x'] * prediction_weight) + (observed_pos['x'] * observation_weight)
            final_z = (predicted_pos['z'] * prediction_weight) + (observed_pos['z'] * observation_weight)
            
            final_map[tag_id] = {'x': final_x, 'z': final_z}

        all_ids = {1, 2, 3}
        seen_ids = set(raw_measurements.keys())
        unseen_ids = all_ids - seen_ids
        if unseen_ids:
            print("  - 注意: 发现未被看到的标签: {}".format(unseen_ids))
            
        print("\n--- [扫描结束], 最终生成的融合地图: ---")
        for tag_id, data in sorted(final_map.items()):
            print("    - ID: {}, 最终坐标(X,Z): ({:.3f}, {:.3f})".format(tag_id, data['x'], data['z']))
            
        return final_map

    def recognize_faces(self):
        print("\n--- 开始人脸识别流程 ---")
        recognized_count = 0
        recognized_names = []
        max_attempts = 10
        print("将进行最多 {} 次识别尝试，目标完成3次不同人脸的识别。".format(max_attempts))
        for i in range(max_attempts):
            if recognized_count >= len(FACE_NAMES_FOR_MISSION):
                print("已成功识别所有目标人脸！")
                break
            print("\n第 {}/{} 次识别尝试...".format(i + 1, max_attempts))
            result_name = YanAPI.sync_do_face_recognition_value(type="recognition")
            if result_name and result_name not in recognized_names:
                recognized_count += 1
                recognized_names.append(result_name)
                recognition_msg = "我看到了 {}".format(result_name)
                print("识别成功: " + recognition_msg)
                YanAPI.sync_do_tts(recognition_msg)
                time.sleep(1)
            else:
                print("识别无结果或识别到重复人脸。")
                time.sleep(1)
        print("\n--- 人脸识别流程结束, 共识别出 {} 个不同的人脸: {} ---".format(recognized_count, recognized_names))
        return recognized_count > 0
    
    def is_fallen(self):
        """使用相对于“正常站立姿态”的角度差来判断是否摔倒。"""
        try:
            gyro_data = YanAPI.get_sensors_gyro()
            if gyro_data and gyro_data['code'] == 0 and gyro_data['data'].get('gyro'):
                current_euler_x = gyro_data['data']['gyro'][0]['euler-x']
                current_euler_y = gyro_data['data']['gyro'][0]['euler-y']
                
                # 【核心修正】计算当前角度与站立基准的差值
                delta_x = abs(current_euler_x - self.standing_euler_x)
                delta_y = abs(current_euler_y - self.standing_euler_y)

                if delta_x > self.FALL_DOWN_THRESHOLD or delta_y > self.FALL_DOWN_THRESHOLD:
                    print("  - [摔倒检测] 警告！检测到相对于站立姿态的大角度变化: dX={:.1f}, dY={:.1f}".format(delta_x, delta_y))
                    return True
        except Exception as e:
            print("  - 警告: 检测摔倒状态时出错: {}".format(e))
        return False
    
    def _safe_stop_vision(self):
        """
        一个安全的视觉服务关闭函数，使用多进程来防止主程序被无限期卡死。
        """
        import multiprocessing

        print("  - [视频流] 准备关闭...")
        
        # 创建一个子进程来执行可能会卡住的API调用
        p = multiprocessing.Process(target=YanAPI.do_visions_visible, args=("stop", "color_detect_remote"))
        p.start()

        # 等待子进程最多 3 秒
        p.join(3.0)

        # 如果3秒后子进程还在运行，说明它卡住了
        if p.is_alive():
            print("  - ⚠️ 警告: 关闭视觉服务的指令超时，可能已被卡住。正在强制终止...")
            p.terminate() # 强制杀死子进程
            p.join()
            print("  - 强制终止完成。程序将继续执行。")
        else:
            print("  - 视觉服务已成功关闭。")
    
    def _safe_clear_vision(self):
        """
        【开机自检】安全地尝试关闭可能残留的视频流服务。
        使用子进程执行，确保即使卡住也不会影响主程序启动。
        """
        import multiprocessing
        print("--- [自检] 正在清理残留的视觉服务...")

        # 定义一个专门用来关闭服务的简单函数
        def stop_task():
            try:
                YanAPI.do_visions_visible(operation="stop", task="color_detect_remote")
            except:
                pass

        # 创建并启动子进程
        p = multiprocessing.Process(target=stop_task)
        p.start()
        # 等待最多 3 秒
        p.join(3.0)

        if p.is_alive():
            print("  - [自检] 警告: 残留服务清理超时，将强制跳过。")
            p.terminate() # 杀掉卡住的子进程
            p.join()
        else:
            print("  - [自检] 清理完毕，系统环境干净。")

    def _get_visual_adjustment(self, target_color):
        """
        【V6 - 计算函数】
        此函数仅负责视觉计算，完全不涉及视频流的开启和关闭。
        它私下完成任务，并返回需要进行的调整。

        Args:
            target_color (str): 目标颜色。

        Returns:
            dict: 包含计算结果的字典。
                成功: {'success': True, 'steps': int, 'direction': str}
                失败: {'success': False}
        """
        print("  - [视觉计算] 正在私下定位物块...")
        
        # 快速头部扫描
        SCAN_ANGLES = [ 90 ]
        best_angle = -1

        for angle in SCAN_ANGLES:
            self._set_head_angle(angle, runtime=300)
            time.sleep(0.4)
            color_result = YanAPI.sync_do_color_recognition()
            if color_result and color_result['code'] == 0 and color_result['data'].get('color'):
                detected_colors_raw = [item['name'] for item in color_result['data']['color']]
                valid_detected_colors = [color for color in detected_colors_raw if color in self.VALID_BLOCK_COLORS]
                
                if target_color in valid_detected_colors:
                    best_angle = angle
                    print("    - 在角度 {}° 发现 {}!".format(angle, target_color))
                    break
        
        self._set_head_angle(90) # 头部回正

        if best_angle == -1:
            print("  - ❌ 计算失败: 未找到 {} 物块。".format(target_color))
            return {'success': False}

        # 根据角度误差计算平移量
        angle_error = best_angle - 90
        SIDE_STEP_DISTANCE_M = 0.04
        DISTANCE_TO_BLOCK_M = 0.30
        
        required_translation_m = DISTANCE_TO_BLOCK_M * math.tan(math.radians(angle_error))
        
        steps_to_move = 0
        direction = ""
        if abs(required_translation_m) > 0.02:
            steps_to_move = round(abs(required_translation_m) / SIDE_STEP_DISTANCE_M)
            if steps_to_move > 0:
                direction = "left" if angle_error > 0 else "right"

        print("  - [计算完成] 需向 {} 平移 {} 步。".format(direction if direction else "无", steps_to_move))
        return {'success': True, 'steps': steps_to_move, 'direction': direction}

    def _start_vision_stream_for_referee(self):
        """
        此函数只负责一件事：开启视频流并打印URL。
        它是一个“即发即忘”的操作，不检查返回值，也不关闭。
        """
        print("  - [视频流] 开启给裁判的直播...")
        try:
            YanAPI.do_visions_visible(operation="start", task="color_detect_remote")
            time.sleep(1.0) # 等待服务启动
        except Exception as e:
            print("  - ⚠️ 开启直播时发生错误 (已忽略): {}".format(e))

    def mission_2_obstacle_crossing(self):
        print("\n" + "="*50)
        print("--- 开始执行任务二：障碍穿越 ---")
        YanAPI.sync_do_tts("任务二，障碍穿越")
        
        recognition_success = self.recognize_faces()
        if not recognition_success:
            print("人脸识别环节失败或未完全成功，但将继续执行后续步骤。")
        else:
            print("人脸识别环节完成！")
            
        print("\n--- 步骤 2.2: 开始执行上下台阶序列 ---")
        try:
            if not self._execute_motion("向前走路1", 3, description="向前走两步，接近台阶", silent_tts=True): raise Exception("Sequence Failed")
            self.correct_heading(with_grab=False)
            if not self._execute_motion("climb3", 1, description="上第一级台阶",speed="normal", silent_tts=True): raise Exception("Sequence Failed")
            self.correct_heading(with_grab=False)
            if not self._execute_motion("climb3", 1, description="上第二级台阶",speed="normal", silent_tts=True): raise Exception("Sequence Failed")
            self.correct_heading(with_grab=False)
            if not self._execute_motion("down3", 1, description="下第一级台阶", speed="normal",silent_tts=True): raise Exception("Sequence Failed")
            self.correct_heading(with_grab=False)
            if not self._execute_motion("down3", 1, description="下第二级台阶", speed="normal",silent_tts=True): raise Exception("Sequence Failed")
            self.correct_heading(with_grab=False)

            print("\n--- 根据任务卡配置 [HURDLE_POSITION = {}]，开始穿越栏架 ---".format(HURDLE_POSITION))

            if HURDLE_POSITION == "LEFT":
                if not self._execute_motion("左走一步", 2, description="向左平移，对准左侧栏架", silent_tts=True): raise Exception("Sequence Failed")
                self.correct_heading(with_grab=False)
                if not self._execute_motion("向前走路1", 1, description="向前走三步，对准中央栏架", speed="normal", silent_tts=True): raise Exception("Sequence Failed")
                self.correct_heading(with_grab=False)
                if not self._execute_motion("向前一步", 1, description="调整", speed="normal", silent_tts=True): raise Exception("Sequence Failed")
                self.correct_heading(with_grab=False)
                if not self._execute_motion("cross3", 1, description="执行跨越动作", speed="normal",silent_tts=True): raise Exception("Sequence Failed")

            elif HURDLE_POSITION == "RIGHT":
                if not self._execute_motion("右走一步", 2, description="向右平移，对准右侧栏架", silent_tts=True): raise Exception("Sequence Failed")
                self.correct_heading(with_grab=False)
                if not self._execute_motion("向前走路1", 1, description="向前走三步，对准中央栏架", speed="normal", silent_tts=True): raise Exception("Sequence Failed")
                self.correct_heading(with_grab=False)
                if not self._execute_motion("向前一步", 1, description="调整", speed="normal", silent_tts=True): raise Exception("Sequence Failed")
                self.correct_heading(with_grab=False)
                if not self._execute_motion("cross3", 1, description="执行跨越动作", speed="normal",silent_tts=True): raise Exception("Sequence Failed")
                
            else: # "CENTER"
                if not self._execute_motion("向前走路1", 1, description="向前走三步，对准中央栏架", speed="normal", silent_tts=True): raise Exception("Sequence Failed")
                self.correct_heading(with_grab=False)
                if not self._execute_motion("向前一步", 1, description="调整", speed="normal", silent_tts=True): raise Exception("Sequence Failed")
                self.correct_heading(with_grab=False)
                if not self._execute_motion("cross3", 1, description="执行跨越动作", speed="normal", silent_tts=True): raise Exception("Sequence Failed")

            self.correct_heading(with_grab=False)
            print("\n--- 障碍穿越序列成功完成！ ---")

        except Exception as e:
            print("\n--- 障碍穿越序列中断！---")
            
        YanAPI.sync_do_tts("任务二已完成")
        print("--- 任务二完成 ---")
        return True

    def _wait_for_vehicle_command(self):
        print("\n--- 正在准备获取车型机器人的指令... ---")
        if USE_MOCK_COMMANDS:
            print("  - [调试模式] 跳过网络等待，立即使用默认指令。")
            tasks = [("绿色", "A"), ("红色", "B")]
            print("  - 使用模拟指令: {}".format(tasks))
            return tasks
        print("  - [真实模式] 正在启动服务器等待指令...")
        HOST = '0.0.0.0'
        PORT = 6000
        COLOR_MAP = { '红': '红色', '绿': '绿色', '蓝': '蓝色' }
        tasks = []
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind((HOST, PORT))
                s.listen(1)
                print("  - 服务器启动，正在监听 {} 端口...".format(PORT))
                s.settimeout(60.0) 
                conn, addr = s.accept()
                with conn:
                    print("  - 已连接客户端：{}".format(addr))
                    data = conn.recv(1024)
                    if data:
                        received_string = data.decode('utf-8')
                        print("  - 收到原始消息: '{}'".format(received_string))
                        if len(received_string) % 2 == 0:
                            instruction_pairs = [received_string[i:i+2] for i in range(0, len(received_string), 2)]
                            for pair in instruction_pairs:
                                color_char, target_char = pair[0], pair[1]
                                if color_char in COLOR_MAP:
                                    full_color = COLOR_MAP[color_char]
                                    tasks.append((full_color, target_char))
                                else:
                                    print("  - 警告: 未知的颜色简称 '{}'".format(color_char))
                            print("  - ✅ 解析成功！生成的任务列表: {}".format(tasks))
                        else:
                            print("  - ❌ 解析失败：消息长度不是偶数！")
        except socket.timeout:
            print("  - ❌ 错误: 等待连接超时！")
        except Exception as e:
            print("  - ❌ 错误: 接收消息时发生异常: {}".format(e))
        if not tasks:
            print("  - ⚠️ 警告: 未能接收到有效指令，将使用默认模拟任务作为后备。")
            tasks = [("红色", "A"), ("蓝色", "B")]
        return tasks

    def _force_refresh_vision_service(self):
        """【硬重启辅助函数】只负责刷新，不负责启动。"""
        try:
            print("    - [硬重启] 正在强制刷新视觉服务...")
            YanAPI.stop_aprilTag_recognition()
            YanAPI.do_visions_visible("start", "face_recognition_remote")
            YanAPI.do_visions_visible("stop", "face_recognition_remote")
            print("    - [硬重启] 视觉服务已刷新。")
        except Exception as e:
            print("    - 警告: 强制刷新视觉服务时发生异常: {}".format(e))

    def _align_to_nav_tag(self, target_distance_m):
        print("\n--- [开始导航 - 一步到位模式], 目标距离: {}m ---".format(target_distance_m))
        original_target_heading = self.target_heading
        
        try:
            target_pos = None
            max_search_attempts = 10
            print("  - [阶段一: 静默搜索] ...")
            all_tags = [{"id": tag_id, "size": self.APRILTAG_SIZE_M} for tag_id in [0, 1, 2, 3, 4]]
            YanAPI.start_aprilTag_recognition(tags=all_tags)
            
            for i in range(max_search_attempts):
                print("  - [搜索中] 第 {}/{} 次检查视野...".format(i + 1, max_search_attempts))
                status = YanAPI.get_aprilTag_recognition_status()
                if status and status['code'] == 0 and status['data'].get('AprilTagStatus'):
                    for tag in status['data']['AprilTagStatus']:
                        if tag['id'] == 0:
                            print("  -  [搜索成功] 已锁定导航码！")
                            target_pos = (tag['position-x'], tag['position-z'])
                            break
                if target_pos: break
            
            YanAPI.stop_aprilTag_recognition()
            if not target_pos:
                print("  -  [搜索失败] 跳过本次导航。")
                return

            pos_x, pos_z = target_pos
            print("  - [阶段二: 一步到位] 基于位置 ({:.3f}, {:.3f}) 进行移动".format(pos_x, pos_z))

            current_heading = self.get_current_heading()
            if abs(current_heading) > self.TOLERANCE_DEGREES:
                print("  - [执行1: 姿态] 校正回0度...")
                self.correct_heading(with_grab=False)
            if abs(pos_x) > 0.02:
                steps = max(1, int(abs(pos_x) / 0.06))
                direction = "left" if pos_x < 0 else "right"
                print("  - [执行2: 水平] 目标在 {} 边，向 {} 平移 {} 步...".format("左" if pos_x < 0 else "右", direction, steps))
                self._execute_motion("walk", steps, direction=direction, description="水平调整", silent_tts=True)
                self.correct_heading(with_grab=False)
            else:
                print("  - [决策] 水平位置已在容差范围内，无需调整。")

            self._execute_motion("reset_抓", 1, description="恢复站姿", silent_tts=True)
            error_z = pos_z - target_distance_m
            if abs(error_z) > 0.07:
                steps = max(1, int(abs(error_z) / 0.15))
                direction = "forward" if error_z > 0 else "backward"
                print("  - [执行3: 距离] 向 {} 移动 {} 步...".format(direction, steps))
                for i in range(steps):
                    print("    - 距离调整第 {}/{} 步".format(i + 1, steps))
                    self._execute_motion("向前走路1", 1, direction=direction, description="距离调整", silent_tts=True)
                    self.correct_heading(with_grab=False)
            else:
                print("  - [决策] 距离已在容差范围内，无需调整。")

            print("  -  [一步到位] 所有导航动作执行完毕。")

        finally:
            print("  - [导航结束] 恢复原始航向...")
            self.target_heading = original_target_heading
            self.correct_heading(with_grab=False)
            YanAPI.stop_aprilTag_recognition()

    def run(self):
        if not self.is_connected:
            print("未连接到机器人，程序退出。")
            return

        class State:
            WAIT_FOR_COMMAND = "wait_for_command"
            MISSION_2 = "mission_2"
            M3_START = "m3_start"
            M3_NAV_A = "m3_nav_a"
            M3_PROCESS_A = "m3_process_a"
            M3_PREP_B = "m3_prep_b"
            M3_NAV_B = "m3_nav_b"
            M3_PROCESS_B = "m3_process_b"
            M3_FINISH = "m3_finish"
            FINISHED = "finished"

        current_state = State.WAIT_FOR_COMMAND
        self.tasks = None
        self.color_a, self.platform_a = None, None
        self.color_b, self.platform_b = None, None
        
        while current_state != State.FINISHED:
            try:
                print("\n" + "="*60)
                print(">>> [状态机] 进入状态: {} <<<".format(current_state))
                print("="*60)

                if current_state == State.WAIT_FOR_COMMAND:
                    self.tasks = self._wait_for_vehicle_command()
                    self.color_a, self.platform_a = self.tasks[0]
                    self.color_b, self.platform_b = self.tasks[1]
                    print("✅ 指令接收成功！任务已加载。")

                    if SKIP_MISSION_2:
                        print("\n" + "="*50 + "\n--- 已根据配置跳过任务二 ---\n" + "="*50)
                        current_state = State.M3_START
                    else:
                        current_state = State.MISSION_2

                elif current_state == State.MISSION_2:
                    self.mission_2_obstacle_crossing()
                    current_state = State.M3_START
                
                elif current_state == State.M3_START:
                    task_announcement_a = "我要去{}号存储区，分拣{}色块".format(self.platform_a, self.color_a)
                    print("播报任务: " + task_announcement_a)
                    YanAPI.sync_do_tts(task_announcement_a)
                    current_state = State.M3_NAV_A

                elif current_state == State.M3_NAV_A:
                    print("\n--- 启动A点导航流程 ---")
                    self._align_to_nav_tag(target_distance_m=0.60)
                    current_state = State.M3_PROCESS_A

                elif current_state == State.M3_PROCESS_A:
                    self.turn_relative(90, with_grab=False, description="左转面向A高台")
                    self.correct_heading(with_grab=False)
                    self._execute_motion("向前走路1", 1, description="前进至A高台前", silent_tts=True)
                    self.correct_heading(with_grab=False)
                    self._execute_motion("向前走路1", 1, description="前进至A高台前", silent_tts=True)
                    self.correct_heading(with_grab=False)
                    self._execute_motion("蹲1", 1, description="执行下蹲动作", silent_tts=True)
                    # adjustment = self._get_visual_adjustment(self.color_a)
                    # if not adjustment['success']:
                    #     print("A平台物块视觉计算失败")
                    # self._start_vision_stream_for_referee()
                    # if adjustment['steps'] > 0:
                    #     self._execute_motion("walk", repeat=adjustment['steps'], direction=adjustment['direction'], description="视觉伺服微调", speed="very slow", silent_tts=True)
                    #     self.correct_heading(with_grab=False)
                    self._execute_motion("向前一步", 1, description="调整", silent_tts=True)
                    self.correct_heading(with_grab=False)
                    self._execute_motion("抓物块3", 1, description="执行抓取动作", silent_tts=True)
                    print("\n--- [状态] 执行A物块的放置流程 ---")
                    self.correct_heading(with_grab=True)
                    self.turn_relative(180, with_grab=True, description="掉头面向置物筐区域")
                    basket_locations = self._scan_for_baskets()
                    target_tag_id_a = self.dynamic_color_map[self.color_a]
                    if target_tag_id_a in basket_locations:
                        target_pos = basket_locations[target_tag_id_a]
                        distance_z, distance_x = target_pos['z'], target_pos['x']
                        print("  - 路径规划: 需前进 {:.2f}m, 平移 {:.2f}m".format(distance_z, distance_x))
                        steps_lr = 0
                        steps_fb = 0
                        HORIZONTAL_TOLERANCE = 0
                        if abs(distance_x) > HORIZONTAL_TOLERANCE:
                            steps_lr = int(abs(distance_x) / 0.031)
                        
                        target_distance = distance_z - 0.15
                        if target_distance > 0:
                            steps_fb = math.ceil(target_distance / 0.20)
                        print("  - [决策] 总计需要平移 {} 步, 前进 {} 步。".format(steps_lr, steps_fb))
                        if steps_lr > 0:
                            print("  - 水平偏差较大，执行宏观平移...")
                            action_lr = "右走抓1" if distance_x > 0 else "左走抓1"
                            for i in range(steps_lr):
                                self._execute_motion(action_lr, 1, description="宏观平移 {}/{}".format(i+1, steps_lr), silent_tts=True)
                                if (i + 1) % 5 == 0 or (i + 1) == steps_lr:
                                    print("    - >> 已执行 {} 步，进行一次航向校准...".format(i + 1))
                                    self.correct_heading(with_grab=True)
                        else:
                            print("  - 水平偏差在容差范围内，无需平移。")
                        self.correct_heading(with_grab=True)
                        if steps_fb > 0:
                            for i in range(steps_fb):
                                self._execute_motion("向前走路抓1", 1, speed="normal", description="持物前进 {}/{}".format(i+1, steps_fb), silent_tts=True)
                                self.correct_heading(with_grab=True)
                            if self.color_a == "蓝色":
                                self._execute_motion("右走抓1", 1, speed="slow", description="任务间特殊微调", silent_tts=True)
                                self.correct_heading(with_grab=True)
                            self._execute_motion("向前一步抓", 1, speed="normal", description="持物前进 {}/{}".format(i+1, steps_fb), silent_tts=True)
                            self.correct_heading(with_grab=True)
                    else:
                        print("  - 严重错误：未能扫描到目标 '{}' 的置物筐！将盲放。".format(self.color_a))
                    
                    self._execute_motion("放0", 1, description="执行放置动作", silent_tts=True)
                    print("--- A-高台 任务放置完成 ---")
                    current_state = State.M3_PREP_B
                
                elif current_state == State.M3_PREP_B:
                    self._force_refresh_vision_service()
                    task_announcement_b = "我要去{}号存储区，分拣{}色块".format(self.platform_b, self.color_b)
                    print("播报任务: " + task_announcement_b)
                    YanAPI.sync_do_tts(task_announcement_b)
                    self.turn_relative(90, with_grab=False, description="左转大致面向导航码")
                    current_state = State.M3_NAV_B

                elif current_state == State.M3_NAV_B:
                    self._align_to_nav_tag(target_distance_m=0.15)
                    current_state = State.M3_PROCESS_B

                elif current_state == State.M3_PROCESS_B:
                    self.turn_relative(90, with_grab=False, description="左转面向B高台")
                    self.correct_heading(with_grab=False)
                    self._execute_motion("向前走路1", 1, description="前进至B高台前", silent_tts=True)
                    self.correct_heading(with_grab=False)
                    self._execute_motion("向前走路1", 1, description="前进至B高台前", silent_tts=True)
                    self.correct_heading(with_grab=False)
                    if self.color_a == "蓝色":
                        print("  - [特殊策略] 检测到第一个任务是蓝色，执行一次向左平移以优化位置...")
                        self._execute_motion("walk", 1, direction="left", speed="slow", description="任务间特殊微调", silent_tts=True)
                        self._execute_motion("reset_抓", 1, description="恢复站姿", silent_tts=True)
                    self._execute_motion("蹲1", 1, description="执行下蹲动作", silent_tts=True)
                    # adjustment = self._get_visual_adjustment(self.color_b)
                    # if not adjustment['success']:
                    #     print("B平台物块视觉计算失败！")
                    # # 3. 【核心修改】第二步：再公开直播 (这会重置/替换掉上一个直播流)
                    # self._start_vision_stream_for_referee()
                    # YanAPI.sync_do_tts("确认成功")

                    # # 4. 执行之前算好的微调
                    # if adjustment['steps'] > 0:
                    #     self._execute_motion("walk", repeat=adjustment['steps'], direction=adjustment['direction'], description="视觉伺服微调", speed="very slow", silent_tts=True)
                    #     self.correct_heading(with_grab=False)

                    self._execute_motion("向前一步", 2, description="调整", silent_tts=True)
                    self.correct_heading(with_grab=False)
                    self._execute_motion("抓物块3", 1, description="执行抓取动作", silent_tts=True)

                    print("\n--- [状态] 执行B物块的放置流程 ---")
                    self.correct_heading(with_grab=True)
                    self.turn_relative(180, with_grab=True, description="掉头面向置物筐区域")
                    basket_locations = self._scan_for_baskets()
                    target_tag_id_b = self.dynamic_color_map[self.color_b]
                    if target_tag_id_b in basket_locations:
                        target_pos = basket_locations[target_tag_id_b]
                        distance_z, distance_x = target_pos['z'], target_pos['x']
                        print("  - 路径规划: 需前进 {:.2f}m, 平移 {:.2f}m".format(distance_z, distance_x))
                        steps_lr = 0
                        steps_fb = 0
                        HORIZONTAL_TOLERANCE = 0
                        if abs(distance_x) > HORIZONTAL_TOLERANCE:
                            steps_lr = int(abs(distance_x) / 0.031)
                        
                        target_distance = distance_z - 0.15
                        if target_distance > 0:
                            steps_fb = math.ceil(target_distance / 0.20)
                        print("  - [决策] 总计需要平移 {} 步, 前进 {} 步。".format(steps_lr, steps_fb))
                        if steps_lr > 0:
                            print("  - 水平偏差较大，执行宏观平移...")
                            action_lr = "右走抓1" if distance_x > 0 else "左走抓1"
                            for i in range(steps_lr):
                                self._execute_motion(action_lr, 1, description="宏观平移 {}/{}".format(i+1, steps_lr), silent_tts=True)
                                if (i + 1) % 5 == 0 or (i + 1) == steps_lr:
                                    print("    - >> 已执行 {} 步，进行一次航向校准...".format(i + 1))
                                    self.correct_heading(with_grab=True)
                        else:
                            print("  - 水平偏差在容差范围内，无需平移。")
                        self.correct_heading(with_grab=True)
                        if steps_fb > 0:
                            for i in range(steps_fb):
                                self._execute_motion("向前走路抓1", 1, speed="normal", description="持物前进 {}/{}".format(i+1, steps_fb), silent_tts=True)
                                self.correct_heading(with_grab=True)
                            if self.color_b == "蓝色":
                                self._execute_motion("右走抓1", 1, speed="slow", description="任务间特殊微调", silent_tts=True)
                            self.correct_heading(with_grab=True)
                            self._execute_motion("向前一步抓", 1, speed="normal", description="持物前进 {}/{}".format(i+1, steps_fb), silent_tts=True)
                            self.correct_heading(with_grab=True)
                    else:
                        print("  - 严重错误：未能扫描到目标 '{}' 的置物筐！将盲放。".format(self.color_b))
                    self._execute_motion("放0", 1, description="执行放置动作", silent_tts=True)
                    print("--- B-高台 任务放置完成 ---")
                    current_state = State.M3_FINISH

                elif current_state == State.M3_FINISH:
                    print("\n" + "="*50)
                    YanAPI.sync_do_tts("任务三已完成")
                    print("--- 任务三全部分拣任务执行完毕 ---")
                    current_state = State.FINISHED

            except FallDownException as e:
                print("\n [状态机] 捕获到摔倒事件: {} ".format(e))
                print("  - 等待15秒让机器人完成自动爬起...")
                time.sleep(15.0)
                print("  - 爬起完成，重新校准航向...")
                self.calibrate_initial_heading()
                print("  - 恢复完成，将重试当前状态: {}".format(current_state))
            
            except Exception as e:
                print("\n [状态机] 捕获到未知严重错误: {} ".format(e))
                print("  - 任务流程中断。")
                current_state = State.FINISHED

        print("\n所有任务已完成或终止。")
        self.shutdown()
    
    def shutdown(self):
        if self.is_connected:
            print("\n" + "="*50)
            print("--- 所有任务完成，正在关闭 ---")
            YanAPI.stop_play_motion()
            print("脚本执行完毕。")

if __name__ == '__main__':
    mission = IrosRoboMission()
    mission.run()