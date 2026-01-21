# WebCodecs H.264 软硬解对比测试工具

这是一个用于测试 WebCodecs API 进行 H.264 视频软件解码和硬件解码性能对比的工具。

## 功能特性

- 支持传统 H.264 文件格式 (.h264, .264)
- 支持 MediaDump 格式（从 WebRTC 连接中 dump 的数据）
- 同时进行软件解码和硬件解码对比
- 实时显示解码性能指标（时间、帧率、帧数）
- 解码后视频可直接播放对比

## 支持的文件格式

### 1. 传统 H.264 文件
- 文件扩展名：`.h264`, `.264`
- 格式：标准的 H.264 Annex B 格式，包含 NAL 单元起始码

### 2. MediaDump 格式
这是通过提供的 MediaDump 用户脚本从 WebRTC 连接中提取的数据格式：

#### 文件结构
- `*_raw.bin` - 原始编码数据块的二进制文件
- `*_frames.json` - 帧信息元数据文件

#### JSON 元数据格式
```json
{
  "trackKind": "video",
  "mid": "0",
  "totalFrames": 150,
  "keyFrames": 5,
  "frames": [
    {
      "isKeyFrame": true,
      "timestamp": 1234567890,
      "size": 8192,
      "sequenceNumber": 1
    },
    {
      "isKeyFrame": false,
      "timestamp": 1234601223,
      "size": 2048,
      "sequenceNumber": 2
    }
  ]
}
```

## 使用方法

### 1. 传统 H.264 文件测试
1. 选择"传统 H.264 文件"选项
2. 上传你的 .h264 或 .264 文件
3. 点击"开始解码测试"

### 2. MediaDump 格式测试
1. 选择"MediaDump 格式"选项
2. 分别上传对应的 .bin 文件和 .json 文件
3. 点击"开始解码测试"

## MediaDump 用户脚本使用

提供的 MediaDump 用户脚本可以从 WebRTC 连接中实时提取编码数据：

1. 安装 Tampermonkey 浏览器扩展
2. 添加提供的用户脚本
3. 访问支持 WebRTC 的网站（如 webdemo.agora.io）
4. 脚本会自动在页面右上角显示控制面板
5. 选择要录制的类型（视频/音频）
6. 点击"开始录制"开始捕获数据
7. 点击"停止录制"会自动下载 .bin 和 .json 文件

## 浏览器兼容性

需要支持 WebCodecs API 的现代浏览器：
- Chrome 94+
- Edge 94+
- Firefox（需要开启实验性功能）

## 技术实现

- **WebCodecs API**: 用于视频解码
- **MediaSource API**: 用于视频播放
- **TransformStream**: 用于数据流处理
- **EncodedVideoChunk**: 用于编码视频帧处理

## 性能指标

工具会显示以下性能指标：
- **解码时间**: 完成所有帧解码的总时间
- **帧率**: 平均解码帧率 (fps)
- **解码帧数**: 成功解码的总帧数
- **解码状态**: 当前解码器状态

## 注意事项

1. MediaDump 格式的数据必须包含完整的帧信息
2. 解码器会等待关键帧开始解码
3. 硬件解码的可用性取决于系统和浏览器支持
4. 某些格式可能只支持软件解码或硬件解码

## 故障排除

- 如果解码失败，检查文件格式是否正确
- 确保 MediaDump 的 .bin 和 .json 文件匹配
- 检查浏览器是否支持 WebCodecs API
- 查看浏览器控制台获取详细错误信息