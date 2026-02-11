class H264Decoder {
  constructor(
    type,
    canvasElement,
    statusElement,
    timeElement,
    fpsElement,
    framesElement,
    frameLocalTime,
    errorElement,
  ) {
    this.type = type; // 'software' or 'hardware'
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.statusElement = statusElement;
    this.timeElement = timeElement;
    this.fpsElement = fpsElement;
    this.framesElement = framesElement;
    this.frameLocalTime = frameLocalTime;
    this.errorElement = errorElement;

    // 获取 canvas 信息显示元素
    this.canvasInfo = document.getElementById(canvasElement.id + "Info");

    // 获取播放控制按钮
    this.playBtn = document.getElementById(type + "PlayBtn");
    this.pauseBtn = document.getElementById(type + "PauseBtn");
    this.prevBtn = document.getElementById(type + "PrevBtn");
    this.nextBtn = document.getElementById(type + "NextBtn");
    this.resetBtn = document.getElementById(type + "ResetBtn");

    this.decoder = null;
    this.frameCount = 0;
    this.startTime = 0;
    this.isDecoding = false;
    this.lastFrame = null;

    // 播放控制相关
    this.frameQueue = [];
    this.isPlaying = false;
    this.playStartTime = 0;
    this.firstFrameTimestamp = 0;
    this.animationFrameId = null;
    this.pausedTime = 0;
    this.currentFrameIndex = 0; // 当前显示的帧索引

    this.initializeControls();
  }

  initializeControls() {
    if (this.playBtn) {
      this.playBtn.addEventListener("click", () => this.play());
    }
    if (this.pauseBtn) {
      this.pauseBtn.addEventListener("click", () => this.pause());
    }
    if (this.prevBtn) {
      this.prevBtn.addEventListener("click", () => this.previousFrame());
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener("click", () => this.nextFrame());
    }
    if (this.resetBtn) {
      this.resetBtn.addEventListener("click", () => this.resetPlayback());
    }
  }

  play() {
    if (this.frameQueue.length === 0) return;

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.playStartTime = performance.now() - this.pausedTime;
      this.renderLoop();

      this.playBtn.disabled = true;
      this.pauseBtn.disabled = false;
      this.prevBtn.disabled = true;
      this.nextBtn.disabled = true;
      this.statusElement.textContent = "播放中...";
    }
  }

  pause() {
    if (this.isPlaying) {
      this.isPlaying = false;
      this.pausedTime = performance.now() - this.playStartTime;

      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      this.playBtn.disabled = false;
      this.pauseBtn.disabled = true;
      this.prevBtn.disabled = false;
      this.nextBtn.disabled = false;
      this.statusElement.textContent = "已暂停";
    }
  }

  previousFrame() {
    if (this.isPlaying) return; // 播放时不允许手动切换

    if (this.currentFrameIndex > 0) {
      this.currentFrameIndex--;
      this.renderFrameByIndex(this.currentFrameIndex);
      this.updateFrameInfo();
    }
  }

  nextFrame() {
    if (this.isPlaying) return; // 播放时不允许手动切换

    if (this.currentFrameIndex < this.frameQueue.length - 1) {
      this.currentFrameIndex++;
      this.renderFrameByIndex(this.currentFrameIndex);
      this.updateFrameInfo();
    }
  }

  renderFrameByIndex(index) {
    if (index >= 0 && index < this.frameQueue.length) {
      const frameData = this.frameQueue[index];
      this.renderFrame(frameData);
    }
  }

  updateFrameInfo() {
    if (this.canvasInfo && this.frameQueue.length > 0) {
      const frameData = this.frameQueue[this.currentFrameIndex];
      this.canvasInfo.textContent = `帧 ${this.currentFrameIndex + 1}/${this.frameQueue.length} | 分辨率: ${frameData.displayWidth}x${frameData.displayHeight} | 时间戳: ${frameData.timestamp}`;
    }
  }

  resetPlayback() {
    this.pause();
    this.pausedTime = 0;
    this.currentFrameIndex = 0;

    // 重置到第一帧
    if (this.frameQueue.length > 0) {
      this.renderFrameByIndex(0);
      this.updateFrameInfo();
    }

    this.statusElement.textContent = "已重置";
  }

  async initialize() {
    try {
      this.statusElement.textContent = "初始化中...";

      // 检查 WebCodecs 支持
      if (!window.VideoDecoder) {
        throw new Error("WebCodecs 不支持");
      }

      // 创建解码器配置
      const config = {
        codec: "avc1.42E01E", // H.264 Baseline Profile
        hardwareAcceleration:
          this.type === "hardware" ? "prefer-hardware" : "prefer-software",
        optimizeForLatency: true,
      };

      // 检查配置支持
      const support = await VideoDecoder.isConfigSupported(config);
      if (!support.supported) {
        throw new Error(
          `${this.type === "hardware" ? "硬件" : "软件"}解码配置不支持`,
        );
      }

      this.statusElement.textContent = "就绪";
      return true;
    } catch (error) {
      this.errorElement.textContent = `初始化失败: ${error.message}`;
      this.statusElement.textContent = "失败";
      return false;
    }
  }

  async decode(h264Data, frameInfo = null) {
    try {
      this.statusElement.textContent = "解码中...";
      this.startTime = performance.now();
      this.frameCount = 0;
      this.isDecoding = true;

      // 创建 VideoDecoder
      this.decoder = new VideoDecoder({
        output: (frame) => this.handleFrame(frame),
        error: (error) => this.handleError(error),
      });

      // 配置解码器
      const config = {
        codec: "avc1.42E01E",
        hardwareAcceleration:
          this.type === "hardware" ? "prefer-hardware" : "prefer-software",
        optimizeForLatency: true,
      };

      this.decoder.configure(config);

      // 解析数据并解码
      await this.parseAndDecode(h264Data, frameInfo);
    } catch (error) {
      this.handleError(error);
    }
  }

  async parseAndDecode(h264Data, frameInfo = null) {
    try {
      if (frameInfo) {
        // 使用 MediaDump 格式解析
        await this.parseMediaDumpFormat(h264Data, frameInfo);
      } else {
        // 使用传统 H.264 NAL 单元解析
        await this.parseTraditionalH264(h264Data);
      }

      // 等待所有帧解码完成
      await this.decoder.flush();

      const endTime = performance.now();
      const totalTime = endTime - this.startTime;
      const fps = this.frameCount / (totalTime / 1000);

      this.timeElement.textContent = `${totalTime.toFixed(2)}ms`;
      this.fpsElement.textContent = `${fps.toFixed(2)} fps`;
      this.statusElement.textContent = "解码完成，可以播放";
    } catch (error) {
      this.handleError(error);
    }
  }

  async parseMediaDumpFormat(rawData, frameInfo) {
    console.log("解析 MediaDump 格式数据:", frameInfo);

    const uint8Array = new Uint8Array(rawData);
    let offset = 0;

    // 根据帧信息解析每一帧
    for (let i = 0; i < frameInfo.frames.length; i++) {
      const frame = frameInfo.frames[i];
      const frameSize = frame.size;

      if (offset + frameSize > uint8Array.length) {
        console.warn(`帧 ${i} 数据不完整，跳过`);
        break;
      }

      const frameData = uint8Array.slice(offset, offset + frameSize);

      try {
        const chunk = new EncodedVideoChunk({
          type: frame.isKeyFrame ? "key" : "delta",
          timestamp: (frame.timestamp * 1000) / 90,
          data: frameData,
          duration:
            i < frameInfo.frames.length - 1
              ? ((frameInfo.frames[i + 1].timestamp - frame.timestamp) * 1000) /
                90
              : 66,
        });

        this.decoder.decode(chunk);
        console.log(
          `[local-${frame.now || "N-A"}] 解码帧 ${i}: ${frame.isKeyFrame ? "Key" : "Delta"} frame, 大小: ${frameSize}, 时间戳: ${frame.timestamp / 90}`,
        );
      } catch (error) {
        console.warn(`解码帧 ${i} 失败:`, error);
      }

      offset += frameSize;
    }
  }

  async parseTraditionalH264(h264Data) {
    // 简单的 H.264 NAL 单元解析
    const nalUnits = this.parseNALUnits(h264Data);

    let timestamp = 0;
    const timestampIncrement = 33333; // ~30fps (microseconds)

    for (const nalUnit of nalUnits) {
      if (this.isKeyFrame(nalUnit) || this.isPFrame(nalUnit)) {
        const chunk = new EncodedVideoChunk({
          type: this.isKeyFrame(nalUnit) ? "key" : "delta",
          timestamp: timestamp,
          data: nalUnit,
        });

        this.decoder.decode(chunk);
        timestamp += timestampIncrement;
      }
    }
  }

  parseNALUnits(data) {
    const nalUnits = [];
    const uint8Array = new Uint8Array(data);
    let start = 0;

    // 查找 NAL 单元起始码 (0x00 0x00 0x00 0x01 或 0x00 0x00 0x01)
    for (let i = 0; i < uint8Array.length - 3; i++) {
      if (uint8Array[i] === 0x00 && uint8Array[i + 1] === 0x00) {
        if (uint8Array[i + 2] === 0x00 && uint8Array[i + 3] === 0x01) {
          // 找到 4 字节起始码
          if (start < i) {
            nalUnits.push(uint8Array.slice(start, i));
          }
          start = i + 4;
          i += 3;
        } else if (uint8Array[i + 2] === 0x01) {
          // 找到 3 字节起始码
          if (start < i) {
            nalUnits.push(uint8Array.slice(start, i));
          }
          start = i + 3;
          i += 2;
        }
      }
    }

    // 添加最后一个 NAL 单元
    if (start < uint8Array.length) {
      nalUnits.push(uint8Array.slice(start));
    }

    return nalUnits.filter((unit) => unit.length > 0);
  }

  isKeyFrame(nalUnit) {
    if (nalUnit.length === 0) return false;
    const nalType = nalUnit[0] & 0x1f;
    return nalType === 5; // IDR frame
  }

  isPFrame(nalUnit) {
    if (nalUnit.length === 0) return false;
    const nalType = nalUnit[0] & 0x1f;
    return nalType === 1; // Non-IDR frame
  }

  handleFrame(frame) {
    this.frameCount++;
    this.framesElement.textContent = this.frameCount.toString();

    // 将帧添加到队列中，而不是立即渲染
    this.frameQueue.push({
      frame: frame,
      timestamp: frame.timestamp,
      displayWidth: frame.displayWidth,
      displayHeight: frame.displayHeight,
    });

    // 如果是第一帧，记录起始时间戳并启用控制按钮
    if (this.frameCount === 1) {
      this.firstFrameTimestamp = frame.timestamp;
      this.currentFrameIndex = 0;
      this.renderFrameByIndex(0); // 显示第一帧
      this.updateFrameInfo();

      // 启用播放控制按钮
      if (this.playBtn) this.playBtn.disabled = false;
      if (this.prevBtn) this.prevBtn.disabled = false;
      if (this.nextBtn) this.nextBtn.disabled = false;
      if (this.resetBtn) this.resetBtn.disabled = false;
    }

    console.log(
      `${this.type} 解码器收到第 ${this.frameCount} 帧，时间戳: ${frame.timestamp}`,
    );
  }

  startPlayback() {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.playStartTime = performance.now();
    this.renderLoop();
  }

  renderLoop() {
    if (!this.isPlaying || this.frameQueue.length === 0) {
      return;
    }

    const currentTime = performance.now();
    const elapsedTime = currentTime - this.playStartTime;

    // 计算当前应该显示的时间戳（微秒转毫秒）
    const targetTimestamp = this.firstFrameTimestamp + elapsedTime * 1000;

    // 查找应该显示的帧
    let frameToRender = null;
    let frameIndex = -1;

    for (let i = 0; i < this.frameQueue.length; i++) {
      const frame = this.frameQueue[i];
      if (frame.timestamp <= targetTimestamp) {
        frameToRender = frame;
        frameIndex = i;
      } else {
        break;
      }
    }

    // 如果找到了应该渲染的帧，并且不是当前帧
    if (
      frameToRender &&
      frameIndex >= 0 &&
      frameIndex !== this.currentFrameIndex
    ) {
      this.currentFrameIndex = frameIndex;
      this.renderFrame(frameToRender);
      this.updateFrameInfo();
    }

    // 继续下一帧
    this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
  }

  renderFrame(frameData) {
    const { frame, displayWidth, displayHeight } = frameData;

    // 调整 canvas 尺寸以匹配视频帧
    if (
      this.canvas.width !== displayWidth ||
      this.canvas.height !== displayHeight
    ) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      if (this.canvasInfo) {
        this.canvasInfo.textContent = `分辨率: ${displayWidth}x${displayHeight}`;
      }
    }

    // 绘制帧到 canvas
    this.ctx.drawImage(frame, 0, 0);

    // 保存最后一帧
    if (this.lastFrame) {
      this.lastFrame.close();
    }
    this.lastFrame = frame.clone();

    console.log(`${this.type} 渲染帧，时间戳: ${frame.timestamp}`);
  }

  handleError(error) {
    console.error(`${this.type} decoder error:`, error);
    this.errorElement.textContent = `解码错误: ${error.message}`;
    this.statusElement.textContent = "错误";
    this.isDecoding = false;
  }

  reset() {
    // 停止播放
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 清理解码器
    if (this.decoder) {
      this.decoder.close();
      this.decoder = null;
    }

    // 清理帧队列
    this.frameQueue.forEach((frameData) => {
      if (frameData.frame) {
        frameData.frame.close();
      }
    });
    this.frameQueue = [];

    if (this.lastFrame) {
      this.lastFrame.close();
      this.lastFrame = null;
    }

    // 清空 canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.width = 640;
    this.canvas.height = 480;

    if (this.canvasInfo) {
      this.canvasInfo.textContent = "等待解码...";
    }

    // 重置播放控制
    if (this.playBtn) this.playBtn.disabled = true;
    if (this.pauseBtn) this.pauseBtn.disabled = true;
    if (this.prevBtn) this.prevBtn.disabled = true;
    if (this.nextBtn) this.nextBtn.disabled = true;
    if (this.resetBtn) this.resetBtn.disabled = true;

    this.frameCount = 0;
    this.isDecoding = false;
    this.playStartTime = 0;
    this.firstFrameTimestamp = 0;
    this.pausedTime = 0;
    this.currentFrameIndex = 0;

    this.statusElement.textContent = "未开始";
    this.timeElement.textContent = "-";
    this.fpsElement.textContent = "-";
    this.framesElement.textContent = "-";
    this.frameLocalTime.textContent = "-";

    this.errorElement.textContent = "";
  }
}

// 主应用逻辑
class H264TestApp {
  constructor() {
    this.h264FileInput = document.getElementById("h264FileInput");
    this.binFileInput = document.getElementById("binFileInput");
    this.jsonFileInput = document.getElementById("jsonFileInput");
    this.startButton = document.getElementById("startTest");
    this.clearButton = document.getElementById("clearTest");
    this.fileInfo = document.getElementById("fileInfo");
    this.globalError = document.getElementById("globalError");
    this.globalSuccess = document.getElementById("globalSuccess");

    this.h264Data = null;
    this.frameInfo = null;
    this.currentFileType = "h264";

    // 同步控制相关
    this.syncPlayBtn = document.getElementById("syncPlayBtn");
    this.syncPauseBtn = document.getElementById("syncPauseBtn");
    this.syncPrevBtn = document.getElementById("syncPrevBtn");
    this.syncNextBtn = document.getElementById("syncNextBtn");
    this.syncResetBtn = document.getElementById("syncResetBtn");
    this.syncFrameInfo = document.getElementById("syncFrameInfo");

    // 创建解码器实例
    this.softwareDecoder = new H264Decoder(
      "software",
      document.getElementById("softwareCanvas"),
      document.getElementById("softwareStatus"),
      document.getElementById("softwareTime"),
      document.getElementById("softwareFPS"),
      document.getElementById("softwareFrames"),
      document.getElementById("softwareLocalTime"),
      document.getElementById("softwareError"),
    );

    this.hardwareDecoder = new H264Decoder(
      "hardware",
      document.getElementById("hardwareCanvas"),
      document.getElementById("hardwareStatus"),
      document.getElementById("hardwareTime"),
      document.getElementById("hardwareFPS"),
      document.getElementById("hardwareFrames"),
      document.getElementById("hardwareLocalTime"),
      document.getElementById("hardwareError"),
    );

    this.initializeEventListeners();
    this.checkWebCodecsSupport();
  }

  initializeEventListeners() {
    // 文件类型切换
    const fileTypeRadios = document.querySelectorAll('input[name="fileType"]');
    fileTypeRadios.forEach((radio) => {
      radio.addEventListener("change", (e) =>
        this.handleFileTypeChange(e.target.value),
      );
    });

    // 文件选择
    this.h264FileInput.addEventListener("change", (e) =>
      this.handleH264FileSelect(e),
    );
    this.binFileInput.addEventListener("change", (e) =>
      this.handleBinFileSelect(e),
    );
    this.jsonFileInput.addEventListener("change", (e) =>
      this.handleJsonFileSelect(e),
    );

    // 按钮事件
    this.startButton.addEventListener("click", () => this.startTest());
    this.clearButton.addEventListener("click", () => this.clearTest());

    // 同步控制事件
    if (this.syncPlayBtn) {
      this.syncPlayBtn.addEventListener("click", () => this.syncPlay());
    }
    if (this.syncPauseBtn) {
      this.syncPauseBtn.addEventListener("click", () => this.syncPause());
    }
    if (this.syncPrevBtn) {
      this.syncPrevBtn.addEventListener("click", () =>
        this.syncPreviousFrame(),
      );
    }
    if (this.syncNextBtn) {
      this.syncNextBtn.addEventListener("click", () => this.syncNextFrame());
    }
    if (this.syncResetBtn) {
      this.syncResetBtn.addEventListener("click", () => this.syncReset());
    }
  }

  handleFileTypeChange(fileType) {
    this.currentFileType = fileType;
    const h264Upload = document.getElementById("h264Upload");
    const mediaDumpUpload = document.getElementById("mediaDumpUpload");

    if (fileType === "h264") {
      h264Upload.style.display = "block";
      mediaDumpUpload.style.display = "none";
    } else {
      h264Upload.style.display = "none";
      mediaDumpUpload.style.display = "block";
    }

    // 重置文件状态
    const binStatus = document.getElementById("binFileStatus");
    const jsonStatus = document.getElementById("jsonFileStatus");
    if (binStatus) {
      binStatus.textContent = "未选择文件";
      binStatus.className = "file-status";
    }
    if (jsonStatus) {
      jsonStatus.textContent = "未选择文件";
      jsonStatus.className = "file-status";
    }

    this.clearTest();
  }

  async handleH264FileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
      this.updateFileInfo("");
      return;
    }

    try {
      this.h264Data = await file.arrayBuffer();
      this.frameInfo = null;
      this.updateFileInfo(`
                <strong>H.264 文件信息:</strong><br>
                名称: ${file.name}<br>
                大小: ${(file.size / 1024 / 1024).toFixed(2)} MB<br>
                类型: ${file.type || "application/octet-stream"}
            `);
      this.checkReadyToStart();
    } catch (error) {
      this.globalError.textContent = `文件读取失败: ${error.message}`;
    }
  }

  async handleBinFileSelect(event) {
    const file = event.target.files[0];
    const statusElement = document.getElementById("binFileStatus");

    if (!file) {
      statusElement.textContent = "未选择文件";
      statusElement.className = "file-status";
      return;
    }

    try {
      this.h264Data = await file.arrayBuffer();
      statusElement.textContent = `✓ ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
      statusElement.className = "file-status success";
      this.updateMediaDumpInfo();
      this.checkReadyToStart();
    } catch (error) {
      statusElement.textContent = `✗ 读取失败: ${error.message}`;
      statusElement.className = "file-status error";
      this.globalError.textContent = `BIN 文件读取失败: ${error.message}`;
    }
  }

  async handleJsonFileSelect(event) {
    const file = event.target.files[0];
    const statusElement = document.getElementById("jsonFileStatus");

    if (!file) {
      statusElement.textContent = "未选择文件";
      statusElement.className = "file-status";
      return;
    }

    try {
      const jsonText = await file.text();
      this.frameInfo = JSON.parse(jsonText);
      statusElement.textContent = `✓ ${file.name} (${this.frameInfo.totalFrames} 帧)`;
      statusElement.className = "file-status success";
      this.updateMediaDumpInfo();
      this.checkReadyToStart();
    } catch (error) {
      statusElement.textContent = `✗ 解析失败: ${error.message}`;
      statusElement.className = "file-status error";
      this.globalError.textContent = `JSON 文件读取失败: ${error.message}`;
    }
  }

  updateMediaDumpInfo() {
    const binFile = this.binFileInput.files[0];
    const jsonFile = this.jsonFileInput.files[0];

    let info = "<strong>MediaDump 文件信息:</strong><br>";

    if (binFile) {
      info += `原始数据: ${binFile.name} (${(binFile.size / 1024 / 1024).toFixed(2)} MB)<br>`;
    }

    if (jsonFile && this.frameInfo) {
      info += `帧信息: ${jsonFile.name}<br>`;
      info += `轨道类型: ${this.frameInfo.trackKind}<br>`;
      info += `总帧数: ${this.frameInfo.totalFrames}<br>`;
      info += `关键帧数: ${this.frameInfo.keyFrames}<br>`;
      info += `MID: ${this.frameInfo.mid || "N/A"}<br>`;
      info += `结束时间: ${this.frameInfo.now || "N/A"}`;
    }

    this.updateFileInfo(info);
  }

  updateFileInfo(html) {
    this.fileInfo.innerHTML = html;
  }

  checkReadyToStart() {
    let ready = false;

    if (this.currentFileType === "h264") {
      ready = this.h264Data !== null;
    } else {
      ready = this.h264Data !== null && this.frameInfo !== null;
    }

    this.startButton.disabled = !ready;
    if (ready) {
      this.globalError.textContent = "";
    }
  }

  async checkWebCodecsSupport() {
    if (!window.VideoDecoder) {
      this.globalError.textContent = "当前浏览器不支持 WebCodecs API";
      return;
    }

    try {
      await Promise.all([
        this.softwareDecoder.initialize(),
        this.hardwareDecoder.initialize(),
      ]);
      this.globalSuccess.textContent = "WebCodecs 初始化成功";
    } catch (error) {
      this.globalError.textContent = `WebCodecs 初始化失败: ${error.message}`;
    }
  }

  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
      this.startButton.disabled = true;
      this.fileInfo.textContent = "";
      return;
    }

    try {
      this.h264Data = await file.arrayBuffer();
      this.fileInfo.innerHTML = `
                <strong>文件信息:</strong><br>
                名称: ${file.name}<br>
                大小: ${(file.size / 1024 / 1024).toFixed(2)} MB<br>
                类型: ${file.type || "application/octet-stream"}
            `;
      this.startButton.disabled = false;
      this.globalError.textContent = "";
    } catch (error) {
      this.globalError.textContent = `文件读取失败: ${error.message}`;
      this.startButton.disabled = true;
    }
  }

  async startTest() {
    if (!this.h264Data) {
      this.globalError.textContent = "请先选择文件";
      return;
    }

    if (this.currentFileType === "mediaDump" && !this.frameInfo) {
      this.globalError.textContent =
        "请选择完整的 MediaDump 文件（.bin 和 .json）";
      return;
    }

    this.startButton.disabled = true;
    this.globalError.textContent = "";
    this.globalSuccess.textContent = "开始解码测试...";

    try {
      // 并行执行软硬解测试
      await Promise.all([
        this.softwareDecoder.decode(this.h264Data, this.frameInfo),
        this.hardwareDecoder.decode(this.h264Data, this.frameInfo),
      ]);

      this.globalSuccess.textContent = "解码测试完成";

      // 启用同步控制
      this.enableSyncControls();
    } catch (error) {
      this.globalError.textContent = `测试失败: ${error.message}`;
    } finally {
      this.startButton.disabled = false;
    }
  }

  enableSyncControls() {
    if (
      this.softwareDecoder.frameQueue.length > 0 &&
      this.hardwareDecoder.frameQueue.length > 0
    ) {
      this.syncPlayBtn.disabled = false;
      this.syncPrevBtn.disabled = false;
      this.syncNextBtn.disabled = false;
      this.syncResetBtn.disabled = false;
      this.updateSyncFrameInfo();
    }
  }

  syncPlay() {
    this.softwareDecoder.play();
    this.hardwareDecoder.play();
    this.syncPlayBtn.disabled = true;
    this.syncPauseBtn.disabled = false;
    this.syncPrevBtn.disabled = true;
    this.syncNextBtn.disabled = true;
  }

  syncPause() {
    this.softwareDecoder.pause();
    this.hardwareDecoder.pause();
    this.syncPlayBtn.disabled = false;
    this.syncPauseBtn.disabled = true;
    this.syncPrevBtn.disabled = false;
    this.syncNextBtn.disabled = false;
  }

  syncPreviousFrame() {
    this.softwareDecoder.previousFrame();
    this.hardwareDecoder.previousFrame();
    this.updateSyncFrameInfo();
  }

  syncNextFrame() {
    this.softwareDecoder.nextFrame();
    this.hardwareDecoder.nextFrame();
    this.updateSyncFrameInfo();
  }

  syncReset() {
    this.softwareDecoder.resetPlayback();
    this.hardwareDecoder.resetPlayback();
    this.syncPlayBtn.disabled = false;
    this.syncPauseBtn.disabled = true;
    this.updateSyncFrameInfo();
  }

  updateSyncFrameInfo() {
    const softwareIndex = this.softwareDecoder.currentFrameIndex;
    const hardwareIndex = this.hardwareDecoder.currentFrameIndex;
    const totalFrames = Math.max(
      this.softwareDecoder.frameQueue.length,
      this.hardwareDecoder.frameQueue.length,
    );

    if (this.syncFrameInfo) {
      this.syncFrameInfo.textContent = `当前帧: ${Math.max(softwareIndex, hardwareIndex) + 1}/${totalFrames}`;
    }
  }

  clearTest() {
    this.softwareDecoder.reset();
    this.hardwareDecoder.reset();

    // 清除文件输入
    this.h264FileInput.value = "";
    this.binFileInput.value = "";
    this.jsonFileInput.value = "";

    // 重置文件状态显示
    const binStatus = document.getElementById("binFileStatus");
    const jsonStatus = document.getElementById("jsonFileStatus");
    if (binStatus) {
      binStatus.textContent = "未选择文件";
      binStatus.className = "file-status";
    }
    if (jsonStatus) {
      jsonStatus.textContent = "未选择文件";
      jsonStatus.className = "file-status";
    }

    // 禁用同步控制
    this.syncPlayBtn.disabled = true;
    this.syncPauseBtn.disabled = true;
    this.syncPrevBtn.disabled = true;
    this.syncNextBtn.disabled = true;
    this.syncResetBtn.disabled = true;
    this.syncFrameInfo.textContent = "";

    this.fileInfo.textContent = "";
    this.h264Data = null;
    this.frameInfo = null;
    this.startButton.disabled = true;
    this.globalError.textContent = "";
    this.globalSuccess.textContent = "";
  }
}

// 启动应用
document.addEventListener("DOMContentLoaded", () => {
  new H264TestApp();
});
