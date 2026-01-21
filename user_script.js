// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      2025-03-18
// @description  try to take over the world!
// @author       You
// @match        https://webdemo.agora.io/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=agoralab.co
// @grant        none
// ==/UserScript==

(function(global, factory) {
  typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global["video-dump"] = {}));
})(this, function(exports2) {
  "use strict";var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  const _MediaDump = class _MediaDump {
    constructor({
      start = false,
      type = "video"
    } = {}) {
      __publicField(this, "sessions", /* @__PURE__ */ new Map());
      __publicField(this, "type", null);
      __publicField(this, "processedTransceivers", /* @__PURE__ */ new Set());
      __publicField(this, "isRecording", false);
      if (_MediaDump.instance) {
        return _MediaDump.instance;
      }
      this.isRecording = start;
      _MediaDump.instance = this;
      this.hijackPeerConnection();
      this.createControlPanel();
      if (start) {
        this.start(type);
      }
    }
    createControlPanel() {
      var _a, _b;
      const panel = document.createElement("div");
      panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      background: rgba(0, 0, 0, 0.8);
      padding: 10px;
      border-radius: 5px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
      const typeSelect = document.createElement("select");
      typeSelect.style.cssText = `
      padding: 5px;
      border-radius: 3px;
      background: #fff;
    `;
      try {
        if ((_a = window.trustedTypes) == null ? void 0 : _a.createHTML) {
          const safeHTML = window.trustedTypes.createHTML(`
          <option value="video">视频</option>
          <option value="audio">音频</option>
        `);
          typeSelect.innerHTML = safeHTML;
        } else {
          typeSelect.innerHTML = `
          <option value="video">视频</option>
          <option value="audio">音频</option>
        `;
        }
      } catch (e) {
        const videoOption = document.createElement("option");
        videoOption.value = "video";
        videoOption.textContent = "视频";
        const audioOption = document.createElement("option");
        audioOption.value = "audio";
        audioOption.textContent = "音频";
        typeSelect.appendChild(videoOption);
        typeSelect.appendChild(audioOption);
      }
      const startButton = document.createElement("button");
      startButton.textContent = "开始录制";
      startButton.style.cssText = `
      padding: 5px 10px;
      border-radius: 3px;
      background: #4CAF50;
      color: white;
      border: none;
      cursor: pointer;
    `;
      const stopButton = document.createElement("button");
      stopButton.textContent = "停止录制";
      stopButton.style.cssText = `
      padding: 5px 10px;
      border-radius: 3px;
      background: #f44336;
      color: white;
      border: none;
      cursor: pointer;
    `;
      stopButton.disabled = true;
      startButton.addEventListener("click", () => {
        this.start(typeSelect.value);
        startButton.disabled = true;
        stopButton.disabled = false;
      });
      stopButton.addEventListener("click", async () => {
        const results = await this.stop();
        startButton.disabled = false;
        stopButton.disabled = true;
        results.forEach((result, index) => {
          const rawUrl = URL.createObjectURL(result.rawBlob);
          const rawLink = document.createElement("a");
          rawLink.href = rawUrl;
          rawLink.download = `dump_${typeSelect.value}_${index + 1}_raw.bin`;
          document.body.appendChild(rawLink);
          rawLink.click();
          document.body.removeChild(rawLink);
          URL.revokeObjectURL(rawUrl);
          const infoUrl = URL.createObjectURL(result.frameInfoBlob);
          const infoLink = document.createElement("a");
          infoLink.href = infoUrl;
          infoLink.download = `dump_${typeSelect.value}_${index + 1}_frames.json`;
          document.body.appendChild(infoLink);
          infoLink.click();
          document.body.removeChild(infoLink);
          URL.revokeObjectURL(infoUrl);
        });
      });
      panel.appendChild(typeSelect);
      panel.appendChild(startButton);
      panel.appendChild(stopButton);
      if (this.isRecording) {
        startButton.disabled = true;
        stopButton.disabled = false;
      }
      try {
        if ((_b = window.trustedTypes) == null ? void 0 : _b.createHTML) {
          const safeHTML = window.trustedTypes.createHTML(panel.outerHTML);
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = safeHTML;
          document.body.appendChild(tempDiv.firstElementChild);
        } else {
          document.body.appendChild(panel);
        }
      } catch (e) {
        document.body.appendChild(panel);
      }
    }
    hijackPeerConnection() {
      const self2 = this;
      const OriginalPeerConnection = window.RTCPeerConnection;
      window.RTCPeerConnection = class extends OriginalPeerConnection {
        constructor(...args) {
          super(...args);
          console.error("hijackPeerConnection", args);
        }
        addTransceiver(trackOrKind, init) {
          const transceiver = super.addTransceiver(trackOrKind, init);
          if (transceiver["__id__"]) {
            return transceiver;
          }
          if ((init == null ? void 0 : init.direction) === "recvonly" || (init == null ? void 0 : init.direction) === "sendrecv") {
            const track = transceiver.receiver.track;
            if (track) {
              const sessionId = `${track.kind}-${track.id}-${Math.random() * 1e3}`;
              transceiver["__id__"] = sessionId;
              if (!self2.processedTransceivers.has(sessionId)) {
                self2.processedTransceivers.add(sessionId);
                self2.startDumpSession(sessionId, transceiver);
              }
            }
          }
          return transceiver;
        }
        async setLocalDescription(description) {
          await super.setLocalDescription(description);
          self2.processNewTransceivers(this);
        }
        async setRemoteDescription(description) {
          await super.setRemoteDescription(description);
          self2.processNewTransceivers(this);
        }
      };
      Object.setPrototypeOf(window.RTCPeerConnection, OriginalPeerConnection);
    }
    processNewTransceivers(pc) {
      const transceivers = pc.getTransceivers();
      transceivers.forEach((transceiver) => {
        if (transceiver["__id__"]) {
          return;
        }
        if (transceiver.direction === "recvonly" || transceiver.direction === "sendrecv") {
          const track = transceiver.receiver.track;
          if (!track) return;
          const transceiverId = `${track.kind}-${track.id}-${Math.random() * 1e3}`;
          transceiver["__id__"] = transceiverId;
          if (this.processedTransceivers.has(transceiverId)) return;
          this.processedTransceivers.add(transceiverId);
          this.startDumpSession(transceiverId, transceiver);
        }
      });
    }
    async startDumpSession(sessionId, transceiver) {
      console.error(
        "startDumpSession",
        sessionId,
        transceiver.mid
      );
      try {
        const receiver = transceiver.receiver;
        const encodedStreams = receiver.createEncodedStreams();
        const session = {
          transceiver,
          chunks: [],
          frameInfos: [],
          isRecording: this.isRecording,
          waitingForKeyFrame: true
          // 初始状态等待关键帧
        };
        this.sessions.set(sessionId, session);
        const self2 = this;
        const transform = new TransformStream({
          async transform(chunk, controller) {
            try {
              const session2 = self2.sessions.get(sessionId);
              if (!session2) return;
              const isKeyFrame = chunk.type === "key";
              const frameSize = chunk.data.byteLength;
              const timestamp = chunk.timestamp;
              const sequenceNumber = chunk.sequenceNumber;
              const frameInfo = {
                isKeyFrame,
                timestamp,
                size: frameSize,
                sequenceNumber
              };
              if (session2.isRecording && self2.type === transceiver.receiver.track.kind) {
                if (session2.waitingForKeyFrame) {
                  if (isKeyFrame) {
                    console.error("找到关键帧，开始录制！");
                    session2.waitingForKeyFrame = false;
                    session2.chunks.push(new Uint8Array(chunk.data));
                    session2.frameInfos.push(frameInfo);
                  }
                } else {
                  session2.chunks.push(new Uint8Array(chunk.data));
                  session2.frameInfos.push(frameInfo);
                  if (isKeyFrame) {
                    console.error("录制到关键帧！");
                  }
                }
              }
              controller.enqueue(chunk);
            } catch (error) {
              console.error("Error reading encoded frames:", error);
            }
          }
        });
        encodedStreams.readable.pipeThrough(transform).pipeTo(encodedStreams.writable);
      } catch (error) {
        console.error("Error starting dump session:", error);
      }
    }
    start(type) {
      console.error("开始录制", type);
      this.type = type;
      this.isRecording = true;
      this.sessions.forEach((session) => {
        session.isRecording = true;
        session.chunks = [];
        session.frameInfos = [];
        session.waitingForKeyFrame = true;
      });
    }
    stop() {
      console.error("停止录制");
      this.isRecording = false;
      return new Promise((resolve) => {
        const results = [];
        this.sessions.forEach((session) => {
          if (session.chunks.length < 1) return;
          session.isRecording = false;
          console.error("录制数据:", session.chunks.length, "帧");
          const rawBlob = new Blob(session.chunks, {
            type: "application/octet-stream"
          });
          const frameInfoData = {
            trackKind: session.transceiver.receiver.track.kind,
            mid: session.transceiver.mid,
            totalFrames: session.frameInfos.length,
            keyFrames: session.frameInfos.filter((f) => f.isKeyFrame).length,
            frames: session.frameInfos
          };
          const frameInfoBlob = new Blob(
            [JSON.stringify(frameInfoData, null, 2)],
            {
              type: "application/json"
            }
          );
          results.push({ rawBlob, frameInfoBlob });
          session.chunks = [];
          session.frameInfos = [];
          console.error(
            "创建了文件",
            session.transceiver.mid,
            session.transceiver.receiver.track.kind,
            "总帧数:",
            frameInfoData.totalFrames,
            "关键帧数:",
            frameInfoData.keyFrames
          );
        });
        resolve(results);
      });
    }
  };
  __publicField(_MediaDump, "instance");
  let MediaDump = _MediaDump;
  window.MediaDump = MediaDump;
  new MediaDump();
  console.error("MediaDump initialized");
  exports2.MediaDump = MediaDump;
  Object.defineProperty(exports2, Symbol.toStringTag, { value: "Module" });
});
