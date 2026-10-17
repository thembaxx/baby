import type { VoiceWorkerRequest, VoiceWorkerResponse } from "./voice-options";

export function startVoiceJob(
  request: VoiceWorkerRequest,
  onProgress?: (progress: number) => void,
) {
  const worker = new Worker(new URL("./voice.worker.ts", import.meta.url), {
    type: "module",
  });
  let rejectJob: (error: Error) => void;
  const promise = new Promise<VoiceWorkerResponse>((resolve, reject) => {
    rejectJob = reject;
    worker.onmessage = ({ data }: MessageEvent<VoiceWorkerResponse>) => {
      if (data.type === "progress") {
        onProgress?.(data.progress);
        return;
      }
      worker.terminate();
      if (data.type === "error") reject(new Error(data.message));
      else resolve(data);
    };
    worker.onerror = () => {
      worker.terminate();
      reject(
        new Error(
          "This voice could not load. Try again or choose a device voice.",
        ),
      );
    };
    worker.postMessage(request);
  });
  return {
    promise,
    cancel() {
      worker.terminate();
      rejectJob(new DOMException("Voice operation cancelled", "AbortError"));
    },
  };
}

export type VoiceJob = ReturnType<typeof startVoiceJob>;
