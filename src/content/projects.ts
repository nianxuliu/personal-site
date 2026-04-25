export type ProjectModule = {
  name: string;
  details: string[];
};

export type ProjectWorkflow = {
  title: string;
  steps: string[];
};

export type ProjectCodeInsight = {
  title: string;
  detail: string;
};

export type ProjectMetric = {
  label: string;
  value: string;
  note?: string;
};

export type ProjectReferenceDoc = {
  label: string;
  href: string;
};

export type Project = {
  slug: string;
  name: string;
  period: string;
  role: string;
  summary: string;
  overview: string;
  techStack: string[];
  context: string[];
  problemStatement: string[];
  responsibilities: string[];
  architecture: string[];
  modules: ProjectModule[];
  workflows: ProjectWorkflow[];
  codeInsights: ProjectCodeInsight[];
  highlights: string[];
  metrics: ProjectMetric[];
  challenges?: string[];
  outcomes: string[];
  futureImprovements?: string[];
  referenceDocs?: ProjectReferenceDoc[];
  repoUrl?: string;
  featured?: boolean;
};

export const projects: Project[] = [
  {
    slug: "movie-ticket-system",
    name: "基于 Spring Boot 3 的影评与票务管理系统",
    period: "2025.12 - 2026.01",
    role: "独立开发",
    summary:
      "围绕高并发抢票场景，我完整实现了从锁座、下单、支付到超时释放的交易闭环，并用 Redis + RabbitMQ + ES 把一致性和检索性能同时拉起来。",
    overview:
      "项目面向热门档期线上购票高峰，覆盖电影检索、在线选座、订单支付、影评互动与后台管理。核心目标是解决高并发下超卖和超时订单释放问题，同时保证检索性能与工程可维护性。实现过程中我重点控制了座位状态与订单状态的边界一致性，并补齐了异常回滚与日志追踪链路。",
    techStack: [
      "Spring Boot 3",
      "MyBatis Plus",
      "MySQL 8",
      "Redis 7",
      "RabbitMQ",
      "Elasticsearch 7.17",
      "MinIO",
      "Nacos",
      "Vue 3",
      "Docker",
    ],
    context: [
      "来源于 JavaEE 课程结课项目，按企业级系统标准设计。",
      "目标不仅是完成业务功能，还要验证高并发场景下的稳定性和一致性方案。",
      "开发过程按真实业务压测思路推进，重点关注异常流和恢复流，不只跑通 happy path。",
    ],
    problemStatement: [
      "多人并发抢同一座位时，数据库事务单独处理容易发生撞座与超卖。",
      "待支付订单若长期占座，会导致库存“假紧张”，影响后续购票转化。",
      "传统 SQL 模糊查询在电影多字段检索场景下响应慢、体验差。",
    ],
    responsibilities: [
      "独立完成需求分析、系统设计、数据库建模与接口设计。",
      "实现订单中心核心链路：锁座、下单、支付、取消、退款、库存释放。",
      "落地检索、缓存、消息队列、对象存储和容器化部署方案。",
      "编写全链路日志审计与关键异常处理逻辑，保证可追溯性。",
    ],
    architecture: [
      "前后端分离架构：Vue 3 负责交互层，Spring Boot 提供 RESTful API。",
      "核心交易链路采用 Redis + MySQL 双层校验保证一致性。",
      "订单超时逻辑基于 RabbitMQ TTL + DLX 异步处理，避免数据库轮询。",
      "检索链路独立到 Elasticsearch，减少主库压力并提升搜索体验。",
      "非结构化资源交给 MinIO，业务配置通过 Nacos 统一管理。",
    ],
    modules: [
      {
        name: "用户与鉴权模块",
        details: [
          "支持注册登录、JWT 鉴权、个人信息维护、管理员角色区分。",
          "密码与支付密码采用加盐哈希（BCrypt）存储。",
        ],
      },
      {
        name: "影院与排片模块",
        details: [
          "支持影院、影厅和排片管理，影厅座位采用 JSON 配置。",
          "排片时进行时间冲突检测，避免同一影厅重叠排片。",
        ],
      },
      {
        name: "订单中心模块",
        details: [
          "实现锁座、下单、支付、关单、退款和订单状态流转。",
          "通过分布式锁与异步消息保障高峰期交易稳定。",
        ],
      },
      {
        name: "电影检索与影评模块",
        details: [
          "电影支持多字段检索和关键词高亮，影评支持回复与点赞。",
          "高频交互计数通过 Redis 处理并回写数据库。",
        ],
      },
    ],
    workflows: [
      {
        title: "高并发选座防超卖流程",
        steps: [
          "前端提交排片 ID + 座位列表后，服务端先尝试 Redis 原子锁座。",
          "锁成功后进入业务校验：场次有效性、开场时间、坏座状态。",
          "执行数据库兜底校验，确认未存在已支付订单占用同座位。",
          "事务内写入待支付订单并发送 TTL 消息，失败时回滚并释放锁。",
          "用户支付成功后更新订单状态；若超时则由死信队列触发释放。",
        ],
      },
      {
        title: "订单超时自动关单流程",
        steps: [
          "创建订单时向 TTL 队列发送消息并设置 15 分钟过期。",
          "消息过期后路由到死信队列，由监听器拉取处理。",
          "监听器检查订单是否仍为待支付，若是则标记取消并释放库存。",
          "清理 Redis 锁座键，恢复座位可售状态。",
        ],
      },
      {
        title: "全文检索流程",
        steps: [
          "电影数据写入或更新时同步到 Elasticsearch 索引。",
          "用户关键词查询采用 multi-match 匹配片名、简介、演职员字段。",
          "返回结果附带高亮片段，提高检索可解释性。",
        ],
      },
    ],
    codeInsights: [
      {
        title: "事务 + 分布式锁的组合使用",
        detail:
          "在 createOrder 中先锁再校验再落库，异常分支主动释放 Redis 锁，避免“锁成功但事务失败”造成座位死锁。",
      },
      {
        title: "TTL + DLX 处理延迟任务",
        detail:
          "将“订单超时”从业务主链路拆出，监听器只处理真正超时且未支付订单，减少接口同步阻塞和数据库扫描。",
      },
      {
        title: "检索层独立",
        detail:
          "将复杂模糊查询迁移到 ES，避免在 MySQL 上做高成本 LIKE 查询，显著改善高并发下检索时延。",
      },
    ],
    highlights: [
      "Redis 原子锁座 + 数据库双重校验，防止一票多卖。",
      "RabbitMQ 死信队列处理订单超时，自动释放库存。",
      "Elasticsearch + IK 中文分词支持多字段搜索与高亮。",
      "MinIO 管理海报资源，降低数据库存储压力。",
    ],
    metrics: [
      { label: "订单超时释放", value: "15 分钟", note: "TTL + DLX 自动关单" },
      { label: "检索规模", value: "百万级数据", note: "文档中描述为毫秒级检索体验" },
      { label: "核心链路", value: "锁座/下单/支付/退款", note: "完整订单生命周期闭环" },
    ],
    challenges: [
      "高并发下座位状态、订单状态、支付状态的一致性边界处理。",
      "在保障业务正确性的同时，降低接口同步处理耗时。",
      "复杂中间件组合后，排障和可观测性要求更高。",
    ],
    outcomes: [
      "完成用户端与后台管理端的完整业务闭环，具备真实业务流程可演示能力。",
      "形成可容器化部署与可扩展的工程骨架，为后续微服务拆分打下基础。",
    ],
    futureImprovements: [
      "拆分为用户/订单/内容等微服务并补齐链路追踪。",
      "引入推荐算法（协同过滤或向量召回）增强观影推荐能力。",
      "增加压测报告与容量评估，形成更完整的工程文档。",
    ],
    referenceDocs: [
      { label: "JavaEE 项目报告 PDF", href: "/references/java-ee/javaee-report.pdf" },
      { label: "前端 API 文档", href: "/references/java-ee/frontend-api.txt" },
    ],
    repoUrl: "https://github.com/nianxuliu?tab=repositories",
    featured: true,
  },
  {
    slug: "github-recommendation-agent",
    name: "GitHub 项目推荐助手智能体",
    period: "2025.11 - 2025.12",
    role: "独立开发",
    summary:
      "我把这个项目做成了本地可跑的 RAG 推荐助手：模型负责解释，GitHub API 负责事实数据，重点解决“能说但不准”的推荐问题。",
    overview:
      "该项目目标是在本地模型环境下输出“可信、可点击、可解释”的开源项目推荐。通过将数据获取和文本生成分离，尽量减少模型凭空编造链接和指标的问题。我还补了流式响应和异步并发策略，让结果速度和可读性都能接受。",
    techStack: ["Python", "FastAPI", "Ollama", "Qwen2.5-7B", "GitHub API", "Asyncio", "Vue 3"],
    context: [
      "来源于个人项目，关注 LLM 实用化而非纯聊天效果。",
      "重点解决“模型回答看起来合理，但链接无效或信息过时”的痛点。",
      "设计原则是先保证可验证，再优化表达质量，避免“华丽但不可用”的输出。",
    ],
    problemStatement: [
      "通用模型对开源生态变化感知滞后，容易推荐过时或不准确项目。",
      "直接由模型生成仓库链接和 Star 数据，存在较高幻觉风险。",
      "多轮推荐场景下，串行数据抓取与翻译会造成明显延迟。",
    ],
    responsibilities: [
      "设计并实现端到端 RAG 流程：意图识别、检索、上下文注入、结构化输出。",
      "定义“数据层真实、生成层摘要”的职责边界，降低错误信息传播。",
      "实现异步并发抓取与流式前端交互，优化响应体验。",
    ],
    architecture: [
      "本地 LLM（Ollama + Qwen）负责理解问题和结果总结。",
      "GitHub API 负责仓库事实数据（链接、描述、Star 等）的实时拉取。",
      "FastAPI 作为编排层，串联检索、清洗、翻译与最终响应。",
      "Vue 3 前端负责流式输出和卡片渲染。",
    ],
    modules: [
      {
        name: "查询理解模块",
        details: [
          "提取语言、方向、技术栈、应用场景等意图特征。",
          "生成可执行检索关键词，减少盲目大范围搜索。",
        ],
      },
      {
        name: "检索与清洗模块",
        details: [
          "调用 GitHub API 拉取候选仓库，统一归一化字段。",
          "过滤无效或低质量结果，保留可直接访问的仓库信息。",
        ],
      },
      {
        name: "生成与展示模块",
        details: [
          "LLM 只做摘要、对比与推荐理由，不负责生成事实数据。",
          "前端以卡片形式展示结构化结果并支持流式反馈。",
        ],
      },
    ],
    workflows: [
      {
        title: "推荐请求处理流程",
        steps: [
          "接收用户需求并解析核心约束（语言、用途、难度等）。",
          "组合关键词并调用 GitHub API 获取候选仓库。",
          "并行执行信息清洗与中英翻译，生成统一结构数据。",
          "将结构数据注入上下文，LLM 输出推荐理由与比较结论。",
          "前端流式展示推荐内容，并提供可点击仓库入口。",
        ],
      },
    ],
    codeInsights: [
      {
        title: "数据与生成职责分离",
        detail:
          "仓库 URL、Star 和简介由 API 直出，模型只输出解释文本，显著降低“看似合理但不可访问”的结果。",
      },
      {
        title: "Asyncio 并发编排",
        detail: "将检索抓取、翻译与格式化任务并行执行，减少 IO 阻塞造成的响应延迟。",
      },
      {
        title: "流式输出与卡片兼容",
        detail: "处理流式文本与复杂卡片混排，避免 Markdown 解析阶段造成结构错乱。",
      },
    ],
    highlights: [
      "本地 RAG 链路可离线运行，适合隐私或受限网络环境。",
      "推荐结果以真实仓库数据为准，提升可信度。",
      "具备可复用的 Agent 工程骨架，便于继续接入更多数据源。",
    ],
    metrics: [
      { label: "检索来源", value: "GitHub API 实时数据", note: "降低知识过时问题" },
      { label: "执行方式", value: "异步并发处理", note: "改善多任务响应时延" },
      { label: "输出形态", value: "流式 + 结构化卡片", note: "兼顾可读性与可点击性" },
    ],
    challenges: [
      "本地模型能力受限时，如何保持推荐质量与响应速度平衡。",
      "流式渲染与复杂结构内容在前端解析层的稳定性。",
    ],
    outcomes: [
      "可稳定返回真实可访问的推荐仓库链接与结构化信息。",
      "沉淀出可复用的“检索增强 + 事实约束”推荐模式。",
    ],
    futureImprovements: [
      "支持多源检索（如 Papers with Code、Hugging Face、Awesome Lists）。",
      "增加推荐反馈闭环，基于用户点击/收藏行为优化排序。",
      "补充评测基准，对召回率、准确率和幻觉率做量化统计。",
    ],
    referenceDocs: [
      { label: "Python 大作业项目报告", href: "/references/python/python-major-project.pdf" },
    ],
    repoUrl: "https://github.com/nianxuliu?tab=repositories",
    featured: true,
  },
  {
    slug: "vision-tracking-opencv-yolo",
    name: "基于 OpenCV + YOLO 的动态检测-追踪-预测算法",
    period: "2025.07 - 2025.09",
    role: "嵌入式开发实习生（算法方向）",
    summary:
      "这个项目我做的是实机可用的追踪控制链路：光流做快速发现，YOLO 做身份确认，CSRT 做连续追踪，再接预测控制与失效兜底。",
    overview:
      "该项目聚焦动态目标追踪：单独用传统视觉算法容易误检，单独用深度模型则时延高。通过混合架构把“速度”和“准确率”结合起来，并输出可直接驱动下位机的控制指令。方案里我重点实现了状态机切换、周期复核和惯性航行，保证短时丢目标时系统不抖死。",
    techStack: ["Python", "OpenCV", "YOLO", "CSRT Tracker", "ROS2", "边缘部署"],
    context: [
      "来源于机器人实习项目，运行环境存在算力受限和场景动态变化。",
      "目标是让机器人在复杂背景下稳定检测、追踪并预测拦截目标。",
      "代码同时适配开发板与 PC 调试环境，便于联调和复现问题。",
    ],
    problemStatement: [
      "纯光流响应快但误触发高，容易对无关运动产生反应。",
      "纯 YOLO 检测精度高但推理成本较大，难以保持实时追踪。",
      "目标短时遮挡或丢失后，系统容易出现追踪漂移和控制抖动。",
    ],
    responsibilities: [
      "设计混合检测-追踪方案并封装为可复用 Python 状态机模块。",
      "实现目标丢失容忍、边界检查和周期复核等鲁棒机制。",
      "将视觉输出转换为麦克纳姆轮控制指令，支持预测性拦截。",
    ],
    architecture: [
      "检测阶段：稠密光流做运动区域海选，ROI 内再调用 YOLO 精确识别。",
      "追踪阶段：使用 CSRT 持续跟踪并定期进行 YOLO 身份复核。",
      "控制阶段：基于目标速度向量预测未来位置，输出电机控制映射。",
      "容错阶段：目标短暂丢失时触发惯性航行，提升重新捕获概率。",
    ],
    modules: [
      {
        name: "目标发现模块（_detect_new_target）",
        details: [
          "通过稠密光流提取运动掩码并定位候选区域。",
          "仅对候选 ROI 运行 YOLO，减少全图推理开销。",
        ],
      },
      {
        name: "目标追踪模块（_track_target）",
        details: [
          "使用 CSRT 提供高鲁棒追踪，适应外观变化和部分遮挡。",
          "引入视觉丢失容忍、边界静止检查和周期复核三重机制。",
        ],
      },
      {
        name: "控制决策模块（_calculate_mecanum_control）",
        details: [
          "引入死区抑制中心抖动，并通过 P 控制器将误差映射为速度分量。",
          "完成麦克纳姆轮逆运动学计算，输出标准化速度指令。",
        ],
      },
      {
        name: "状态机主循环（process_frame）",
        details: [
          "统一调度检测、追踪、预测、惯性航行等状态切换逻辑。",
          "确保每帧都输出可执行的最终控制映射。",
        ],
      },
    ],
    workflows: [
      {
        title: "实时追踪主流程",
        steps: [
          "若未进入追踪态，先通过光流定位 ROI，再用 YOLO 确认目标身份。",
          "确认目标后切换 CSRT 追踪并持续更新目标速度向量。",
          "根据预测时间窗口计算未来目标位置并输出拦截控制指令。",
          "若目标短时丢失，启用惯性航行维持上一条有效运动指令。",
          "当触发失败检测条件时重置追踪并重新进入发现阶段。",
        ],
      },
    ],
    codeInsights: [
      {
        title: "状态机封装",
        detail:
          "把检测、追踪、预测、容错组合到单一入口 process_frame，使外部调用端无需感知复杂内部状态。",
      },
      {
        title: "三重失败检测",
        detail: "同时监控丢失帧数、边界粘连、周期身份复核，避免追踪框长期“粘”在背景目标上。",
      },
      {
        title: "预测性控制",
        detail: "不是追当前位置，而是基于速度预测未来约 400ms 落点，提升动态拦截命中概率。",
      },
    ],
    highlights: [
      "光流海选 + ROI 检测兼顾实时性与精度。",
      "CSRT + 周期复核提升复杂场景鲁棒性。",
      "惯性航行机制降低短时丢目标导致的系统抖动。",
    ],
    metrics: [
      { label: "预测窗口", value: "约 400ms", note: "用于预测性拦截控制" },
      { label: "惯性航行", value: "约 0.5s", note: "目标短时丢失时维持运动" },
      { label: "周期复核", value: "每 10 帧", note: "YOLO 进行身份再确认" },
      { label: "视觉丢失容忍", value: "最多 10 帧", note: "避免短时抖动误重置" },
    ],
    challenges: [
      "高速目标导致极端运动模糊，任何外观匹配方法都会受限。",
      "模型泛化不足时，在复杂背景和光照变化下误检风险上升。",
    ],
    outcomes: [
      "形成可直接复用的独立追踪控制模块，便于接入不同机器人平台。",
      "在边缘设备场景下实现更稳定的实时追踪与控制输出。",
    ],
    futureImprovements: [
      "引入更高帧率相机或运动去模糊策略改善极端速度场景。",
      "补充目标重识别策略，提升长时间遮挡后的恢复能力。",
      "建立标准化评测集，对追踪成功率和时延做量化评估。",
    ],
    referenceDocs: [
      { label: "算法说明文档", href: "/references/yolo/opencv-yolo-design.txt" },
      { label: "开发板版本 track.py", href: "/references/yolo/track.py" },
      { label: "PC 调试版本 track_pc.py", href: "/references/yolo/track_pc.py" },
      { label: "README", href: "/references/yolo/readme.txt" },
    ],
    repoUrl: "https://github.com/nianxuliu?tab=repositories",
  },
  {
    slug: "iros-future-of-robo-2025",
    name: "2025 IROS & Future of Robo 国际机器人竞赛",
    period: "2025.10 - 2025.11",
    role: "队员（人形机器人动作编写）",
    summary:
      "我在这项比赛里主做人形机器人执行链路，核心是把任务拆成稳定状态机，并在导航、抓取、投放和异常恢复之间做可靠衔接。",
    overview:
      "项目以竞赛任务完成率为核心，关注多阶段动作编排、感知辅助定位和临场稳定性。在有限时间内需要完成障碍穿越、命令解读、目标识别、抓取与投放等连续动作链路。我负责的实现重点是航向校正、任务切换和摔倒恢复，保证比赛现场流程不中断。",
    techStack: ["ROS2", "OpenCV", "AprilTag", "运动控制", "传感器融合", "任务状态机"],
    context: [
      "竞赛环境动态且节奏紧凑，系统稳定性优先于单点最优性能。",
      "任务链条长、阶段多，任何环节失误都可能影响最终成绩。",
      "现场调试窗口有限，因此程序设计优先可恢复与可诊断，而不是一次性脚本。",
    ],
    problemStatement: [
      "机器人需要在多障碍场景下保持步态稳定与动作连贯。",
      "远程命令解读与现场感知定位需要低延迟协同。",
      "抓取与投放阶段对定位误差容忍度低，容错空间有限。",
    ],
    responsibilities: [
      "负责人形机器人动作编写和任务执行状态切换逻辑。",
      "实现障碍穿越阶段运动控制，保障复杂地形下动作稳定。",
      "参与视觉辅助定位流程，支持高台目标抓取与投放任务。",
    ],
    architecture: [
      "整体以任务状态机驱动：命令接收 -> 感知定位 -> 动作执行 -> 结果校验。",
      "感知层结合 AprilTag 与色块信息辅助机器人位姿修正。",
      "控制层根据阶段目标切换动作策略，保证完成度与稳定性平衡。",
    ],
    modules: [
      {
        name: "障碍穿越控制模块",
        details: ["基于传感器反馈动态调整步态和动作节奏。", "覆盖走台阶、跨栏等障碍动作模板。"],
      },
      {
        name: "任务解读与执行模块",
        details: [
          "接收车型机器人远程命令并映射到可执行动作序列。",
          "通过状态机保证阶段切换可控，避免动作冲突。",
        ],
      },
      {
        name: "视觉辅助定位模块",
        details: [
          "使用 AprilTag 与色块检测定位目标和投放区域。",
          "支撑高台取物与定点投放的动作闭环。",
        ],
      },
    ],
    workflows: [
      {
        title: "竞赛任务执行流程",
        steps: [
          "接收上游命令并解析当前阶段任务目标。",
          "执行障碍穿越动作并根据反馈调整姿态。",
          "进入视觉定位阶段，确定目标块和投放篮框位置。",
          "执行抓取、转移和投放动作，并进行阶段结果确认。",
        ],
      },
    ],
    codeInsights: [
      {
        title: "状态机化任务控制",
        detail: "将复杂竞赛流程拆分为可切换状态，降低现场调试时的联动风险和不可控行为。",
      },
      {
        title: "感知与控制联动",
        detail: "在执行动作过程中持续利用视觉与传感器信息做姿态修正，而非一次感知后盲执行。",
      },
    ],
    highlights: [
      "完成障碍穿越、目标抓取和投放等完整动作链路。",
      "实现远程命令解读与现场执行的稳定衔接。",
      "在比赛场景下保证动作稳定性和任务完成率。",
    ],
    metrics: [
      { label: "竞赛成绩", value: "108 / 150", note: "获得赛项冠军" },
      { label: "任务类型", value: "障碍 + 抓取 + 投放", note: "多阶段连续执行" },
    ],
    outcomes: [
      "在 2025 IROS & Future of Robo 赛项中获得冠军。",
      "积累了完整的机器人竞赛任务落地经验。",
    ],
    futureImprovements: [
      "进一步引入动作策略自动调参与仿真回放系统。",
      "将视觉定位和动作规划解耦，提升模块复用性。",
    ],
    referenceDocs: [
      { label: "任务主代码 main_mission.py", href: "/references/iros/main_mission.py" },
      { label: "赛项竞赛文档 PDF", href: "/references/iros/competition-rules.pdf" },
      { label: "报名表", href: "/references/iros/application.txt" },
      { label: "参会证明", href: "/references/iros/attendance.txt" },
    ],
    repoUrl: "https://github.com/nianxuliu?tab=repositories",
  },
];

export function getProjectBySlug(slug: string) {
  return projects.find((project) => project.slug === slug);
}
