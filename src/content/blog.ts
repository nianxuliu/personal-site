export type BlogPostStatus = "Draft" | "Published";

export type BlogSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  code?: string;
  codeLanguage?: string;
};

export type BlogReferenceDoc = {
  label: string;
  href: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readingTime: string;
  status: BlogPostStatus;
  sourceProject?: string;
  intro: string;
  referenceDocs?: BlogReferenceDoc[];
  sections: BlogSection[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: "redis-seat-locking-double-check",
    title: "Redis 锁座 + 数据库双检：影评票务系统防超卖实战拆解",
    excerpt: "这篇就聊一件事：抢票高并发下，座位怎么锁才不翻车。",
    date: "2026-04-25",
    readingTime: "18 min read",
    sourceProject: "movie-ticket-system",
    status: "Published",
    intro:
      "这部分代码我当时改了很多轮，原因很简单：只要这里出错，就会一票多卖。\n我不想把正确性赌在一个组件上，所以把入口清洗、Redis 锁、业务校验、数据库兜底、异常回滚都做成了串联防线。\n我在下面看到的代码都是我自己课程项目里实际写过并跑过的，不是示意图。\n我这篇只讲链路里的技术动作，不写空泛总结。\n如果我也在做库存占用类下单系统，这套组合可以直接对照着落。",
    referenceDocs: [
      { label: "JavaEE 项目报告 PDF", href: "/references/java-ee/javaee-report.pdf" },
      { label: "service 代码片段", href: "/references/java-ee/service-snippets.txt" },
      { label: "杂项代码片段", href: "/references/java-ee/misc-code.txt" },
      { label: "前端 API 文档", href: "/references/java-ee/frontend-api.txt" },
    ],
    sections: [
      {
        heading: "1. 并发问题不是“慢”而是“错。",
        paragraphs: [
          "在票务场景里，同一时刻会有大量请求命中同一排片和同一座位。\n如果只盯着接口耗时优化，很容易忽略真正的风险点：请求结果错误。\n一旦发生一票多卖，后续的退款、客服、补偿和口碑成本都会被放大。\n因此系统设计优先级必须是先保证一致性，再谈吞吐和延迟。\n我在实现时把“座位不会卖错”定义成首要约束，而不是可选优化项。",
          "我把超卖风险拆成了三类并分别处理。\n第一类是入口数据污染，例如重复座位、非法格式、空字符串混入。\n第二类是并发竞争，多个请求同时争抢同一资源。\n第三类是状态穿透，即应用层判定可卖，但数据库事实已不可卖。\n这三类问题必须分别落地策略，单点方案无法覆盖全部边界。",
        ],
      },
      {
        heading: "2. 下单入口先做数据清洗，再做并发控。",
        paragraphs: [
          "真实线上请求永远比理。DTO 更脏。\n我在 createOrder 入口先把前端 seats 。split、trim、去重和空值过滤，保证后续逻辑只处理干净数据。\n这个步骤看起来基础，但可以提前消灭大量隐藏 bug，例如同一订单重复提交同座位、座位字符串夹杂空格等。\n如果输入层不收敛，后面的锁与事务只会在错误数据上浪费资源。\n所以我把这一步放在分布式锁之前，避免无意义上锁。",
        ],
        codeLanguage: "java",
        code: `public String createOrder(OrderDTO dto, Long userId) {
    List<String> rawSeats = dto.getSeats();
    if (rawSeats == null || rawSeats.isEmpty()) {
        throw new RuntimeException("请选择座位");
    }

    Set<String> distinctSet = new HashSet<>();
    for (String seatStr : rawSeats) {
        String[] splitSeats = seatStr.split(",");
        for (String s : splitSeats) {
            String cleanSeat = s.trim();
            if (cleanSeat.isEmpty()) continue;
            if (distinctSet.contains(cleanSeat)) {
                throw new RuntimeException("订单中包含重复座。 " + cleanSeat);
            }
            distinctSet.add(cleanSeat);
        }
    }

    if (distinctSet.isEmpty()) {
        throw new RuntimeException("有效座位为空");
    }
    List<String> finalSeats = new ArrayList<>(distinctSet);
    // 后续逻辑只使。finalSeats
}`,
      },
      {
        heading: "3. Redis 原子锁座只做第一层门卫，不做最终事。",
        paragraphs: [
          "清洗后的座位数据进入并发控制阶段。\n我使。Redis 锁服务做原子锁座，把“资源竞争”尽量在应用层快速拦下。\n这样做的收益是可以在数据库前过滤掉大部分冲突请求，降低主库竞争压力。\n。Redis 锁只负责“先占坑”，并不代表最终可售事实。\n所以我把它定义为第一层门卫，而不是唯一可信来源。",
          "拿到锁之后，我仍然继续做排片存在性、开场时间、影厅配置和坏座信息校验。\n这些检查和业务语义强相关，不能简单靠缓存状态替代。\n一旦任何校验失败，我会在异常路径立即释放已加的座位锁。\n这个释放动作必须覆盖所。RuntimeException 分支，不允许遗漏。\n否则最典型的后果是座位被“锁死”但没有任何订单持有。",
        ],
        codeLanguage: "java",
        code: `boolean lockSuccess = redisLockService.tryLockSeats(dto.getScheduleId(), finalSeats, userId);
if (!lockSuccess) {
    throw new RuntimeException("部分座位已被锁定，请重新选择");
}

try {
    Schedule schedule = scheduleService.getById(dto.getScheduleId());
    if (schedule == null) {
        throw new RuntimeException("排片不存。);
    }
    if (schedule.getStartTime().isBefore(LocalDateTime.now())) {
        redisLockService.releaseSeatLocks(dto.getScheduleId(), finalSeats);
        throw new RuntimeException("电影已开场，停止售票。);
    }
    // ... 业务校验继续
} catch (RuntimeException e) {
    redisLockService.releaseSeatLocks(dto.getScheduleId(), finalSeats);
    throw e;
}`,
      },
      {
        heading: "4. 坏座与边界校验落在业务层，数据库再做最终兜。",
        paragraphs: [
          "我在影厅配置里维。rows、cols 。broken_seats，创建订单时会解。seat_config 并逐座校验。\n这一步可以直接拦截“座位越界”和“坏座购买”这种逻辑错误。\n通过这一层可以确保后续事务只处理合法且可售的座位集合。\n随后再进入数据库兜底检查，确认已支付订单中不存在同座位占用。\n只有两层都通过，才进入订单创建和金额计算。",
          "很多系统只做到缓存锁就结束，这在高并发异常场景下不够稳。\n我的做法是把数据库状态当作最终事实源，尤其是 status=已支。的记录。\n即使上游出现锁过期、重试、网络抖动等情况，数据库兜底仍能挡住错误落库。\n从工程角度看，这是用一次额外查询换高代价事故规避。\n在交易系统里，这个成本是值得的。",
        ],
      },
      {
        heading: "5. 前端协同：防重复点击 + 失败后刷新座位图",
        paragraphs: [
          "并发正确性不仅是后端事务问题，前端交互也会放大或抑制并发冲突。\n我在前端提交下单时加。loading 状态，防止用户连续点击造成重复请求。\n当后端返回抢座失败时，前端会立即刷新座位图，缩短用户与真实状态之间的差距。\n这能显著减少用户误操作和无意义重试，也能降低服务端噪音请求。\n前后端在并发场景里的目标应该一致：尽快收敛到同一份真实状态。",
        ],
        codeLanguage: "ts",
        code: `const submitOrder = async () => {
  if (selectedSeats.value.length === 0) {
    ElMessage.warning("请至少选择一个座。);
    return;
  }

  const orderForm = {
    scheduleId: route.params.scheduleId,
    seats: selectedSeats.value,
  };

  try {
    loading.value = true;
    const res = await createOrder(orderForm);
    if (res.code === 200) {
      ElMessage.success("锁定座位成功，请。5分钟内支。);
      router.push({ name: "OrderPay", params: { orderNo: res.data } });
    } else {
      ElMessage.error(res.message || "选座失败，座位可能已被抢");
      refreshSeatMap();
    }
  } finally {
    loading.value = false;
  }
};`,
      },
    ],
  },
  {
    slug: "rabbitmq-order-timeout-dlx",
    title: "订单超时自动关单：RabbitMQ TTL + 死信队列的工程化实现",
    excerpt: "这篇很实在：15 分钟不付钱，系统怎么稳稳回收座位。",
    date: "2026-04-25",
    readingTime: "16 min read",
    sourceProject: "movie-ticket-system",
    status: "Published",
    intro:
      "订单超时这块我当时卡了挺久，因为它看上去是“定时任务”，本质上却是“交易状态一致性”问题。\n如果超时回收做得粗糙，要么库存假占用，要么已支付订单被误取消。\n后来我把轮询改成 TTL + DLX，让过期消息驱动释放逻辑，并在监听端严格做状态判断。\n下面的配置和监听代码都来自我本机项目里的真实实现。\n整篇只讲技术链路，不讲产品层面的延伸内容。",
    referenceDocs: [
      { label: "JavaEE 项目报告 PDF", href: "/references/java-ee/javaee-report.pdf" },
      { label: "RabbitMQ 与监听代。", href: "/references/java-ee/misc-code.txt" },
      { label: "service 代码片段", href: "/references/java-ee/service-snippets.txt" },
      { label: "前端 API 文档", href: "/references/java-ee/frontend-api.txt" },
    ],
    sections: [
      {
        heading: "1. 为什么放弃定时轮。",
        paragraphs: [
          "轮询方案的缺陷非常直接：它会周期性扫描大量无变化数据。\n当订单规模上来后，数据库会被重复读取和条件过滤拖慢。\n同时，轮询间隔越长，超时处理越滞后；间隔越短，资源占用越重。\n这在高峰期通常是两头不讨好。\n因此我把“超时检查”从同步查询改成消息过期触发。",
          "事件驱动的好处在于它天然按需执行。\n只有真正到期的订单会被转发并消费，不再需要全量扫描。\n这让订单中心主链路更轻，也让超时处理逻辑更独立。\n从系统分层角度看，超时任务被从业务请求线程中剥离了出来。\n后续如果要叠加通知、统计、审计，也能直接在消费侧扩展。",
        ],
      },
      {
        heading: "2. 消息拓扑：TTL 队列 + 死信交换。+ 消费队列",
        paragraphs: [
          "订单创建时发送消息到 TTL 队列，消息在队列内等待固定时长。\n一旦超。15 分钟，消息不会被直接丢弃，而是按死信规则路由到释放队列。\n释放队列由监听器消费，消费动作包含关单与释放座位锁。\n这条链路把时间控制权交给消息基础设施，而不是应用层轮询器。\n在工程实践里，这种分工更清晰，也更利于后续观测和重试。",
        ],
        codeLanguage: "java",
        code: `@Bean
public Queue orderTtlQueue() {
    return QueueBuilder.durable(ORDER_TTL_QUEUE)
            .ttl(900000) // 15分钟 TTL
            .deadLetterExchange(ORDER_DLX_EXCHANGE)
            .deadLetterRoutingKey(ORDER_DLX_ROUTING_KEY)
            .build();
}

@Bean
public Queue orderReleaseQueue() {
    return new Queue(ORDER_RELEASE_QUEUE, true);
}

@Bean
public Binding orderDlxBinding() {
    return BindingBuilder.bind(orderReleaseQueue())
            .to(orderDlxExchange())
            .with(ORDER_DLX_ROUTING_KEY);
}`,
      },
      {
        heading: "3. 监听器关键点：只处理仍处于待支付状态的订单",
        paragraphs: [
          "监听器收到过期消息后，第一件事不是写库，而是查订单当前状态。\n因为订单。TTL 到达前可能已经被支付，不能被超时逻辑误取消。\n我在代码里明确做。status==0 判断，只有待支付订单才执行关单。\n状态更新完成后再释。Redis 座位锁，恢复可售库存。\n这是一条典型的“状态校验优先于动作执行”的交易规则。",
        ],
        codeLanguage: "java",
        code: `@RabbitListener(queues = RabbitMQConfig.ORDER_RELEASE_QUEUE)
public void listenOrderTimeout(String orderNo) {
    if (orderNo == null) return;

    QueryWrapper<Order> query = new QueryWrapper<>();
    query.eq("order_no", orderNo);
    Order order = orderService.getOne(query);
    if (order == null) return;

    if (order.getStatus() == 0) {
        order.setStatus(2); // 2-已取。        orderService.updateById(order);

        String lockKeyPrefix = "lock:seat:" + order.getScheduleId() + ":";
        List<String> seats = List.of(order.getSeatInfo().split(","));
        List<String> lockKeys = seats.stream()
            .map(seat -> lockKeyPrefix + seat)
            .collect(Collectors.toList());
        redisTemplate.delete(lockKeys);
    }
}`,
      },
      {
        heading: "4. 状态一致性与并发边界处理",
        paragraphs: [
          "这条链路的核心不是“能自动关单”，而是“不会误关单”。\n支付动作和超时动作存在并发窗口，必须通过状态检查缩小错误覆盖面。\n我在消费端坚持先读后写，并把状态流转限定为待支。-> 已取消。\n支付成功路径则走待支。-> 已支付，两个分支通过状态值天然互斥。\n只要状态迁移规则明确，消息重复投递和重试都更容易做幂等控制。",
          "另外一个实践重点是。Redis 锁释放与订单状态更新放在同一业务语义中。\n如果只更新订单不释放锁，库存依然不可售；如果只释放锁不更新状态，会出现账务语义错乱。\n这两个动作必须作为同一条“超时处理事务”看待。\n虽然技术上跨了数据库和缓存，但业务上它们共同定义了订单最终态。\n我在实现时就是按这个原则组织监听器逻辑的。",
        ],
      },
      {
        heading: "5. 前端状态同步与体验闭环",
        paragraphs: [
          "后端异步关单之后，前端也要尽快反映状态变化，否则用户会看到“假待支付”。\n我的前端列表页通过订单状态映射展示待支付、已支付、已取消三种状态。\n当超时监听器执行完成后，用户刷新列表即可看到订单转为超时取消。\n这虽然不是复杂前端技术，但对于交易透明度非常关键。\n库存和订单状态在用户界面上及时一致，才能减少误解和重复操作。",
        ],
        codeLanguage: "ts",
        code: `const fetchOrders = async () => {
  const res = await getMyOrders({ page: 1, size: 10 });
  orderList.value = res.data.records.map((item) => {
    if (item.status === 0) item.statusText = "待支。;
    else if (item.status === 1) item.statusText = "已支。;
    else if (item.status === 2) item.statusText = "已取。(超时)";
    return item;
  });
};`,
      },
    ],
  },
  {
    slug: "hybrid-vision-tracking-opencv-yolo",
    title: "边缘端实时追踪实录：OpenCV + YOLO + CSRT 的落地细节",
    excerpt: "这篇是我的实机调参笔记：目标怎么找、怎么追、丢了怎么救。",
    date: "2026-04-25",
    readingTime: "24 min read",
    sourceProject: "vision-tracking-opencv-yolo",
    status: "Published",
    intro:
      "这块代码是我在边缘端做实时拦截时反复迭代出来的，不是一次写完。\n最早我只用 OpenCV，响应快但误检多；后来只用 YOLO，识别准但延迟又太高。\n最后稳定下来的是混合方案：光流先海选，YOLO 做确认，CSRT 持续追踪，再接预测控制。\n这篇我不写伪代码，只把真实函数拆开讲清楚。",
    referenceDocs: [
      { label: "算法说明文档", href: "/references/yolo/opencv-yolo-design.txt" },
      { label: "开发板版本 track.py", href: "/references/yolo/track.py" },
      { label: "PC 调试版本 track_pc.py", href: "/references/yolo/track_pc.py" },
      { label: "README", href: "/references/yolo/readme.txt" },
    ],
    sections: [
      {
        heading: "1. 双版本部署前提：开发板优先，PC 兜底",
        paragraphs: [
          "我的工程入口不是“先追踪”，而是先把运行环境区分清楚。\n`track.py` 会先尝试导入 `hobot_dnn`，能用 BPU 就走 BPU，失败再回退到 `ultralytics`。\n这样做不是炫技，而是让开发板和 PC 调试共用一套状态机逻辑。\n同一个模块在两端都能跑，调参和故障复现才不会分叉。\n这个结构也直接决定了后面 `_run_yolo_inference` 必须做统一适配层。",
          "我在参数层也把关键约束收敛在类初始化里，包括检测阈值、重确认频率、丢失容忍和惯性航行时长。\n这些参数不是装饰，它们分别控制误检成本、漂移成本和控制抖动成本。\n比如 `RECONFIRM_INTERVAL=10` 表示每 10 帧做一次身份复核，`TRACKING_LOSS_TOLERANCE=10` 对应短时丢帧容忍。\n如果这些阈值散落在函数内部，后期定位“为什么误触发/为什么误重置”会非常痛苦。\n所以我把“可调参”当成工程一等公民，而不是补丁。",
        ],
        codeLanguage: "python",
        code: `try:
    from hobot_dnn import pyeasy_dnn as dnn
    print("成功导入地平。aarch64 dnn 库。)
    IS_EDGE_PLATFORM = True
except ImportError:
    print("警告: 无法导入 hobot_dnn 库，将使用PC版的YOLO进行模拟。)
    from ultralytics import YOLO
    IS_EDGE_PLATFORM = False

class HybridTracker:
    def __init__(self, model_path='best.pt'):
        self.TARGET_CLASS_ID = 1
        self.CONFIDENCE_THRESHOLD = 0.25
        self.MIN_TARGET_AREA, self.MAX_TARGET_AREA = 500, 25000
        self.TRACKING_LOSS_TOLERANCE = 10
        self.prediction_time_ms = 400
        self.COASTING_DURATION = 0.5
        self.RECONFIRM_INTERVAL = 10`,
      },
      {
        heading: "2. 发现阶段：光流海选 + ROI YOLO 确认",
        paragraphs: [
          "在未追踪状态下，我没有直接全图 YOLO，而是先做稠密光流把运动区域筛出来。\n真正的 YOLO 推理只在 `roi = frame[y:y+h, x:x+w]` 上跑，这一步显著压低了每帧成本。\n这也是我能在边缘端保持实时性的关键动作，不是模型本身有多轻。\n如果全图硬跑 YOLO，哪怕检测准确率高，也很容易把控制链路拖慢。\n对机器人而言，慢半拍通常比“偶发漏检”更致命。",
          "这里还有一个很实际的点：光流只负责“有运动”，YOLO 才负责“是不是目标”。\n这层职责分离让误检和漏检有了可拆解的优化路径。\n如果误触发太多，我会先调运动阈值和面积阈值；如果身份确认不稳，再调类别和置信度阈值。\n这样排障时不会一上来就在单个大模型里盲目调参。\n工程上可控，才谈得上长期维护。",
        ],
        codeLanguage: "python",
        code: `def _detect_new_target(self, frame, frame_gray):
    flow = cv2.calcOpticalFlowFarneback(self.prev_gray, frame_gray, None, 0.5, 3, 15, 3, 5, 1.2, 0)
    magnitude, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
    motion_mask = (magnitude > self.MOTION_DETECTION_THRESHOLD).astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    motion_mask = cv2.morphologyEx(motion_mask, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(motion_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours: return False, (0,0), None

    largest_contour = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest_contour)
    if self.MIN_TARGET_AREA < area < self.MAX_TARGET_AREA:
        x, y, w, h = cv2.boundingRect(largest_contour)
        roi = frame[y:y+h, x:x+w]
        if roi.size == 0: return False, (0,0), None
        detections = self._run_yolo_inference(roi)
        is_target_confirmed = any(
            d['class_id'] == self.TARGET_CLASS_ID and d['confidence'] > self.CONFIDENCE_THRESHOLD
            for d in detections
        )
        if is_target_confirmed:
            self._initialize_tracker(frame, (x, y, w, h))
            center = (x + w // 2, y + h // 2)
            return True, center, self.bbox
    return False, (0,0), None`,
      },
      {
        heading: "3. 追踪阶段：CSRT + 多重失效判断 + 周期复核",
        paragraphs: [
          "进入追踪态后我用的是 CSRT，但我没有把它当成“永远正确”的黑盒。\n`_track_target` 里先调用 `tracker.update`，失败时进入 `lost_frames_count` 容忍窗口。\n如果连续丢失超过阈值，立刻重置，避免控制端持续吃到过期框。\n同时我又加了边界检查和静止检查，专门处理“追踪框粘背景”这个老问题。\n这几层判断叠在一起，才构成可上线的追踪逻辑。",
          "仅靠几何检查还不够，我还让系统每隔固定帧数做一次 YOLO 身份复核。\n它的作用是防漂移，不是再检测一次图像这么简单。\n一旦复核失败，直接视为追踪失效并复位，而不是继续凑合。\n这一步在复杂背景里特别关键，能明显减少“看起来在追，实际已经跑偏”的假稳定。\n从实战看，宁可早点重置，也不要让错控持续输出。",
        ],
        codeLanguage: "python",
        code: `def _track_target(self, frame):
    success, bbox = self.tracker.update(frame)
    if not success:
        self.lost_frames_count += 1
        if self.lost_frames_count > self.TRACKING_LOSS_TOLERANCE:
            self._reset_tracker()
            return False, (0,0), None
        return False, (0,0), self.bbox

    self.lost_frames_count = 0
    x, y, w, h = map(int, bbox)
    sane = True
    if w <= 0 or h <= 0 or x <= 2 or y <= 2:
        sane = False

    current_center = (x + w // 2, y + h // 2)
    if self.last_bbox_center is not None:
        dist = np.sqrt((current_center[0] - self.last_bbox_center[0])**2 + (current_center[1] - self.last_bbox_center[1])**2)
        if dist < self.STATIC_PIXEL_TOLERANCE: self.static_frames_count += 1
        else: self.static_frames_count = 0
    self.last_bbox_center = current_center
    if self.static_frames_count > self.STATIC_FRAMES_TOLERANCE:
        sane = False

    self.reconfirm_frame_count += 1
    if sane and self.reconfirm_frame_count >= self.RECONFIRM_INTERVAL:
        self.reconfirm_frame_count = 0
        roi = frame[y:y+h, x:x+w]
        detections = self._run_yolo_inference(roi)
        is_still_target = any(d['class_id'] == self.TARGET_CLASS_ID and d['confidence'] > self.CONFIDENCE_THRESHOLD for d in detections)
        if not is_still_target:
            sane = False`,
      },
      {
        heading: "4. 控制阶段：预测落点转麦轮控制映射",
        paragraphs: [
          "控制这块我没有做“追当前中心点”的朴素方案，而是先更新像素速度，再算预测点。\n预测窗口在代码里是 `prediction_time_ms = 400`，实际就是看 400ms 后目标大概在哪。\n然后把预测点喂给 `_calculate_mecanum_control`，输出四个电机的 `[action, speed, time]`。\n这个映射里还加了 dead zone，避免目标接近中心时电机来回抖动。\n这套做法更像“拦截”而不是“追尾”。",
          "我在速度转换时也做了统一归一化，保证不同偏差下输出都落在可控区间。\n具体是把理论最大速度作为分母，将轮速映射到 `-100~100` 百分比。\n再把绝对值转成 `int`，并过滤小于 5 的抖动速度。\n这样下位机侧收到的数据格式稳定，不会因为小数和噪声导致动作异常。\n从控制链路看，稳定格式和稳定算法同样重要。",
        ],
        codeLanguage: "python",
        code: `def _calculate_mecanum_control(self, predicted_center):
    dx = predicted_center[0] - self.frame_center_x
    dy = predicted_center[1] - self.frame_center_y

    if np.sqrt(dx**2 + dy**2) < self.dead_zone_radius:
        return {i: [0, 0, 40] for i in range(4)}

    Kp_translation, Kp_rotation = 0.4, 0.3
    vx, vy, v_rot = dy * Kp_translation, dx * Kp_translation, dx * Kp_rotation
    motor_speeds = [vx - vy - v_rot, vx + vy + v_rot, vx + vy - v_rot, vx - vy + v_rot]
    max_possible_speed = np.sqrt(self.frame_center_x**2 + self.frame_center_y**2) * Kp_translation

    control_map = {}
    for i in range(4):
        speed_percent_float = (motor_speeds[i] / max_possible_speed) * 100
        speed_percent_clipped = np.clip(speed_percent_float, -100, 100)
        action = 0 if speed_percent_clipped >= 0 else 1
        final_speed = int(abs(speed_percent_clipped))
        if final_speed < 5:
            final_speed = 0
        control_map[i] = [int(action), int(final_speed), 40]
    return control_map`,
      },
      {
        heading: "5. 主循环三态切换：检测、追踪、惯性航行",
        paragraphs: [
          "真正把模块跑稳的是 `process_frame`，它把内部状态切换收敛成一个外部接口。\n追踪成功时进入预测控制，追踪失败时根据条件进入惯性航行或直接停机。\n惯性航行不是无限续命，而是 `COASTING_DURATION` 时间窗内复用上一次有效运动指令。\n这一步对真实场景很有价值，目标短时遮挡时不至于立刻“刹死”。\n同时它又有超时退出，避免系统在错误指令上长期漂移。",
          "这套状态切换和说明文档里写的设计目标是一致的：把链路做成可控退化。\n目标暂时丢了，系统先平稳过渡；确认找不回，再安全停止。\n相比“检测不到就立刻归零”，这种做法更适合运动机器人。\n对外调用者只拿一个返回值 `final_control_map`，不用关心内部细节。\n这也是它能被后续系统复用的关键。",
        ],
        codeLanguage: "python",
        code: `def process_frame(self, frame):
    was_tracking_before_this_frame = self.tracking
    if self.prev_gray is None:
        self.prev_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        return {}

    frame_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    if self.tracking:
        detected, center, _ = self._track_target(frame)
    else:
        detected, center, _ = self._detect_new_target(frame, frame_gray)

    final_control_map = {}
    if detected:
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
        if self.is_coasting and time.time() < self.coasting_end_time:
            final_control_map = self.last_motion_control_map
        else:
            self.is_coasting = False
            self.last_motion_control_map = {}

    self.prev_gray = frame_gray.copy()
    return final_control_map`,
      },
    ],
  },
  {
    slug: "state-machine-practice-in-iros",
    title: "IROS 任务代码复盘：人形机器人状态机与赛场执行链路",
    excerpt: "这篇按比赛代码复盘：状态机怎么跑，任务怎么稳着做完。",
    date: "2026-04-25",
    readingTime: "27 min read",
    sourceProject: "iros-future-of-robo-2025",
    status: "Published",
    intro:
      "这篇是我在赛后做的一次完整代码复盘。\n我不讲泛化套路，直接对着自己实际跑过的 `main_mission.py` 按执行链路拆开讲。\n证书记录的会期是 2025-10-19 到 2025-10-25，地点在杭州；那一周让我更确定一件事：决定成败的不是某个炫技动作，而是状态机把感知、导航、抓取和恢复稳定串起来。\n所以正文会重点展开状态切换、命令接入、导航校准、投放定位和摔倒恢复。\n下面所有代码都来自我的真实项目文件，不写伪代码。",
    referenceDocs: [
      { label: "任务主代码 main_mission.py", href: "/references/iros/main_mission.py" },
      { label: "赛项竞赛文档 PDF", href: "/references/iros/competition-rules.pdf" },
      { label: "报名材料", href: "/references/iros/application.txt" },
      { label: "参会证明", href: "/references/iros/attendance.txt" },
    ],
    sections: [
      {
        heading: "1. 任务入口先定状态机：把赛程动作拆成可执行阶段",
        paragraphs: [
          "我这版代码最关键的一点，是先把任务拆成状态，再给每个状态写动作。\n`WAIT_FOR_COMMAND -> MISSION_2 -> M3_START -> M3_NAV_A ... -> M3_FINISH` 这条主线非常清晰。\n这比把动作脚本堆在一起稳得多，因为每一步都有明确的进入和退出条件。\n现场调试时，一旦某段出问题，可以直接定位到具体状态，而不是全链路盲查。\n在竞赛里，这种“可诊断结构”通常比单次动作炫技更有价值。",
          "从代码组织看，我把任务二和任务三拆开，并预留 `SKIP_MISSION_2` 开关做联调。\n这让我可以在不完整跑赛道的情况下快速迭代后半段抓取与投放流程。\n这种做法非常实用，特别是在比赛前夕时间紧、场地窗口少的时候。\n另外状态常量集中定义，避免了字符串散落造成的跳转错误。\n这是典型的工程化状态机写法，而不是一次性比赛脚本。",
        ],
        codeLanguage: "python",
        code: `def run(self):
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
    while current_state != State.FINISHED:
        if current_state == State.WAIT_FOR_COMMAND:
            self.tasks = self._wait_for_vehicle_command()
            if SKIP_MISSION_2:
                current_state = State.M3_START
            else:
                current_state = State.MISSION_2`,
      },
      {
        heading: "2. 命令接入：6000 端口接收车型机器人任务",
        paragraphs: [
          "我的命令接入不是硬编码，而是走 `socket`，这样车型机器人和人形机器人之间可以通过协议层解耦。\n`_wait_for_vehicle_command` 里监听 `0.0.0.0:6000`，收到数据后按两个字符一组解析。\n解析结果会映射成 `(颜色, 平台)` 任务列表，直接喂给后续状态机。\n如果超时或解析失败，还有默认后备任务，避免主流程直接崩掉。\n这就是竞赛程序里常说的“通信不稳定时仍可继续执行”。",
          "这里我觉得写得比较稳的一点是白名单映射。\n`COLOR_MAP` 先做语义归一，再进入任务层。\n这样后面抓取和投放逻辑都只处理统一颜色词，不会被上游文本差异污染。\n我还支持 `USE_MOCK_COMMANDS`，现场断链时能立刻切到调试模式。\n对比赛这种高压场景，这是很有价值的兜底。",
        ],
        codeLanguage: "python",
        code: `def _wait_for_vehicle_command(self):
    HOST = '0.0.0.0'
    PORT = 6000
    COLOR_MAP = {'。: '红色', '。: '绿色', '。: '蓝色'}
    tasks = []
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, PORT))
        s.listen(1)
        s.settimeout(60.0)
        conn, addr = s.accept()
        with conn:
            data = conn.recv(1024)
            received_string = data.decode('utf-8')
            instruction_pairs = [received_string[i:i+2] for i in range(0, len(received_string), 2)]
            for pair in instruction_pairs:
                color_char, target_char = pair[0], pair[1]
                if color_char in COLOR_MAP:
                    tasks.append((COLOR_MAP[color_char], target_char))
    if not tasks:
        tasks = [("红色", "A"), ("蓝色", "B")]
    return tasks`,
      },
      {
        heading: "3. 任务二障碍穿越：动作序列和航向校正交替执行",
        paragraphs: [
          "障碍穿越这段不是单纯播一串动作，而是“走一步、校一次航向”的策略。\n我在 `mission_2_obstacle_crossing` 里每个关键动作后都接 `correct_heading`。\n这等于把陀螺仪反馈持续引入流程，抑制累计偏航。\n对于台阶和栏架这种误差放大的场景，这种交替执行非常必要。\n否则后续抓取区起点会偏，任务三会被前序误差拖垮。",
          "另外我把栏架位置做成配置项 `HURDLE_POSITION`，支持 `LEFT/CENTER/RIGHT` 三条路线。\n这比硬编码路线更适配现场任务卡变化。\n同一套程序通过配置就能切不同路径，不需要临场改核心代码。\n在比赛里减少“临时改代码”本身就是稳定性收益。\n这一点和状态机框架是配套的。",
        ],
        codeLanguage: "python",
        code: `def mission_2_obstacle_crossing(self):
    if not self._execute_motion("向前走路1", 3, description="向前走两步，接近台阶", silent_tts=True):
        raise Exception("Sequence Failed")
    self.correct_heading(with_grab=False)
    if not self._execute_motion("climb3", 1, description="上第一级台。", speed="normal", silent_tts=True):
        raise Exception("Sequence Failed")
    self.correct_heading(with_grab=False)
    if not self._execute_motion("down3", 1, description="下第一级台。", speed="normal", silent_tts=True):
        raise Exception("Sequence Failed")
    self.correct_heading(with_grab=False)

    if HURDLE_POSITION == "LEFT":
        self._execute_motion("左走一。", 2, description="向左平移，对准左侧栏。", silent_tts=True)
    elif HURDLE_POSITION == "RIGHT":
        self._execute_motion("右走一。", 2, description="向右平移，对准右侧栏。", silent_tts=True)
    else:
        self._execute_motion("向前走路1", 1, description="向前走三步，对准中央栏架", speed="normal", silent_tts=True)
    self.correct_heading(with_grab=False)
    self._execute_motion("cross3", 1, description="执行跨越动作", speed="normal", silent_tts=True)`,
      },
      {
        heading: "4. 导航对齐：AprilTag 定位 + 航向闭环",
        paragraphs: [
          "我在 `_align_to_nav_tag` 里做的是“先找标签，再一步到位调整”，逻辑很实用。\n先用 AprilTag id=0 做导航基准，再按 `x` 偏差做左右平移，按 `z` 偏差做前后步进。\n每次位移后再 `correct_heading`，避免连续移动导致航向飘掉。\n这套策略的优点是计算量小、动作直接，适合实机现场快速执行。\n相比复杂路径规划，这种规则式对齐更稳定、更可控。",
          "转向函数 `turn` 也做了粗调和微调分层。\n误差大于阈值时走 `turn around`，误差较小时走 `min左转/min右转` 并循环校正。\n这能减少大角度时的回摆和小角度时的过冲。\n同时它支持持物和非持物两种动作模板，避免抓取后姿态失控。\n对任务三这种“拿着物块还要转身”的场景，这个细节很关键。",
        ],
        codeLanguage: "python",
        code: `def _align_to_nav_tag(self, target_distance_m):
    target_pos = None
    all_tags = [{"id": tag_id, "size": self.APRILTAG_SIZE_M} for tag_id in [0, 1, 2, 3, 4]]
    YanAPI.start_aprilTag_recognition(tags=all_tags)
    status = YanAPI.get_aprilTag_recognition_status()
    for tag in status['data']['AprilTagStatus']:
        if tag['id'] == 0:
            target_pos = (tag['position-x'], tag['position-z'])
            break
    YanAPI.stop_aprilTag_recognition()

    pos_x, pos_z = target_pos
    if abs(pos_x) > 0.02:
        steps = max(1, int(abs(pos_x) / 0.06))
        direction = "left" if pos_x < 0 else "right"
        self._execute_motion("walk", steps, direction=direction, description="水平调整", silent_tts=True)
        self.correct_heading(with_grab=False)

def correct_heading(self, with_grab=False):
    return self.turn(self.target_heading, with_grab=with_grab)`,
      },
      {
        heading: "5. 放置区识别：三角度扫描 + 物理顺序融合",
        paragraphs: [
          "抓取后的投放环节里，我用 `_scan_for_baskets` 做多角度观测，这段非常有代表性。\n头部按 `[60, 90, 120]` 三个角度扫描 AprilTag，把相机坐标转换到机体坐标。\n然后不是直接相信单次观测，而是做“物理顺序 + 间距约束 + 加权融合”。\n这一步能显著缓解视觉噪声，尤其是在比赛光照和遮挡不稳定时。\n属于典型的“把工程先验加入感知结果”。",
          "我比较认可我这里的融合思路：预测模型占 60%，实测值占 40%。\n先保证整体队形不乱，再吸收实时观测做微调。\n这种做法在标签偶发抖动时，比纯观测更稳，比纯理论更灵活。\n最后得到的是可直接用于平移步数和前进步数计算的最终地图。\n在任务三的放置成功率上，这种处理通常是决定性因素。",
        ],
        codeLanguage: "python",
        code: `def _scan_for_baskets(self):
    raw_measurements = {}
    scan_angles = [60, 90, 120]
    tags_to_detect = [{"id": tag_id, "size": self.APRILTAG_SIZE_M} for tag_id in [1, 2, 3]]
    YanAPI.start_aprilTag_recognition(tags=tags_to_detect)

    for angle_deg in scan_angles:
        self._set_head_angle(angle_deg)
        status = YanAPI.get_aprilTag_recognition_status()
        for tag in status['data']['AprilTagStatus']:
            tag_id = tag['id']
            if tag_id not in raw_measurements:
                cam_x, cam_z = tag['position-x'], tag['position-z']
                head_angle_rad = math.radians(angle_deg - 90)
                body_x = cam_x * math.cos(-head_angle_rad) - cam_z * math.sin(-head_angle_rad)
                body_z = cam_x * math.sin(-head_angle_rad) + cam_z * math.cos(-head_angle_rad)
                raw_measurements[tag_id] = {'x': body_x, 'z': body_z}

    prediction_weight = 0.6
    observation_weight = 0.4
    final_map = {}
    for tag_id in raw_measurements:
        final_x = predicted_map[tag_id]['x'] * prediction_weight + raw_measurements[tag_id]['x'] * observation_weight
        final_z = predicted_map[tag_id]['z'] * prediction_weight + raw_measurements[tag_id]['z'] * observation_weight
        final_map[tag_id] = {'x': final_x, 'z': final_z}`,
      },
      {
        heading: "6. 异常兜底：摔倒检测与状态恢复重试",
        paragraphs: [
          "我这版代码另一个很实用的点，是把摔倒检测做进了主执行路径，而不是赛后补救。\n`is_fallen` 用站立基准和实时欧拉角差值做判断，超过阈值就直接触发异常。\n状态机里捕获 `FallDownException` 后会等待自动爬起，再重新校准航向并继续执行当前状态。\n这让系统具备“被打断后可恢复”的能力，而不是一次失败就全盘结束。\n在真实比赛里，这类恢复逻辑往往比单次动作精度更能保分。",
          "此外我还有视觉服务安全关闭和强制刷新函数。\n它们通过子进程超时机制，避免 API 卡死把主流程拖挂，这是很工程化的处理。\n机器人比赛里最怕“整机卡死”，所以这种隔离式调用非常必要。\n从结构看，我的核心思路是：主链路要可持续，外围服务可降级。\n这个原则我建议继续保留到后续版本。",
        ],
        codeLanguage: "python",
        code: `def is_fallen(self):
    gyro_data = YanAPI.get_sensors_gyro()
    current_euler_x = gyro_data['data']['gyro'][0]['euler-x']
    current_euler_y = gyro_data['data']['gyro'][0]['euler-y']
    delta_x = abs(current_euler_x - self.standing_euler_x)
    delta_y = abs(current_euler_y - self.standing_euler_y)
    if delta_x > self.FALL_DOWN_THRESHOLD or delta_y > self.FALL_DOWN_THRESHOLD:
        return True
    return False

while current_state != State.FINISHED:
    try:
        if current_state == State.WAIT_FOR_COMMAND:
            self.tasks = self._wait_for_vehicle_command()
            self.color_a, self.platform_a = self.tasks[0]
            self.color_b, self.platform_b = self.tasks[1]
    except FallDownException as e:
        time.sleep(15.0)
        self.calibrate_initial_heading()
        print("  - 恢复完成，将重试当前状。 {}".format(current_state))`,
      },
    ],
  },
];

export function getBlogPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}



