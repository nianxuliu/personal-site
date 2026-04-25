export const aboutContent = {
  heading: "关于我",
  paragraphs: [
    "我是刘栩年，上海电力大学计算机科学与技术（卓越培养计划）本科在读，GPA 3.65/4.0。",
    "我具备 Java / Python 全栈开发经验，关注高并发系统设计、LLM 应用落地与前端工程化。",
    "在校期间获得 2025 IROS & Future of Robo 国际机器人竞赛冠军、校级三等奖学金与中国国际大学生创新大赛院赛三等奖。",
    "实习阶段在中科非凡机器人参与边缘端模型部署与 ROS2 系统集成，完成视觉追踪链路在地平线 RDK X5 平台上的落地调试。",
  ],
  highlights: [
    "竞赛经历：2025 IROS & Future of Robo 国际机器人竞赛冠军",
    "工程实践：Spring Boot + Vue3、Redis、RabbitMQ、Elasticsearch、MinIO",
    "AI 方向：具备本地 LLM 与计算机视觉模型部署及应用经验",
    "系统能力：熟悉 MyBatis-Plus、Nacos、Docker，以及高并发下的状态一致性治理",
    "工程场景：能独立完成从需求拆解、接口设计到上线部署与问题排查的完整链路",
    "语言能力：已通过英语六级，可进行英文技术文档阅读与检索",
  ],
  timeline: [
    {
      period: "2025.12 - 2026.01",
      title: "影评与票务管理系统",
      detail:
        "独立完成高并发票务系统，从锁座、防超卖、订单超时处理到全文检索与容器化部署形成完整闭环。",
      projectSlug: "movie-ticket-system",
    },
    {
      period: "2025.11 - 2025.12",
      title: "GitHub 项目推荐助手智能体",
      detail: "搭建本地 RAG 推荐流程，结合 GitHub API 与流式前端交互，重点优化低幻觉与可解释输出。",
      projectSlug: "github-recommendation-agent",
    },
    {
      period: "2025.10 - 2025.11",
      title: "IROS & Future of Robo 竞赛",
      detail: "负责人形机器人动作编写与任务执行逻辑，获得赛项冠军（108/150）。",
      projectSlug: "iros-future-of-robo-2025",
    },
    {
      period: "2025.07 - 2025.09",
      title: "中科非凡机器人实习",
      detail: "参与视觉追踪算法研发与边缘部署，融合 YOLO + OpenCV + CSRT，提升动态场景追踪鲁棒性。",
      projectSlug: "vision-tracking-opencv-yolo",
    },
  ],
} as const;
