/**
 * @fileoverview Streaming support for FluxHTTP
 * @module @fluxhttp/core/features/streaming
 */

import type { fluxhttpRequestConfig, fluxhttpResponse, FluxProgressEvent } from '../types';

/**
 * Stream chunk interface for processing streamed data
 */
export interface StreamChunk {
  /** Raw chunk data */
  data: Uint8Array;
  /** Chunk size in bytes */
  size: number;
  /** Whether this is the final chunk */
  done: boolean;
  /** Cumulative bytes received */
  totalBytes: number;
}

/**
 * Stream configuration options
 */
export interface StreamConfig {
  /** Maximum chunk size in bytes */
  chunkSize?: number;
  /** Whether to enable backpressure handling */
  backpressure?: boolean;
  /** High water mark for internal buffering */
  highWaterMark?: number;
  /** Stream encoding for text streams */
  encoding?: 'utf8' | 'ascii' | 'base64' | 'binary';
  /** Whether to auto-close the stream on completion */
  autoClose?: boolean;
}

/**
 * Progress tracking for streaming operations
 */
export interface StreamProgress extends FluxProgressEvent {
  /** Current transfer rate in bytes/second */
  rate?: number;
  /** Estimated time remaining in seconds */
  timeRemaining?: number;
  /** Stream direction */
  direction: 'upload' | 'download';
}

/**
 * Stream event handlers
 */
export interface StreamEventHandlers {
  /** Called when stream starts */
  onStart?: () => void;
  /** Called for each chunk */
  onChunk?: (chunk: StreamChunk) => void;
  /** Called with progress updates */
  onProgress?: (progress: StreamProgress) => void;
  /** Called when stream completes */
  onComplete?: () => void;
  /** Called on stream error */
  onError?: (error: Error) => void;
  /** Called when stream is aborted */
  onAbort?: () => void;
}

/**
 * Streaming response reader
 */
export class StreamingResponseReader {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private decoder: TextDecoder | null = null;
  private totalBytes = 0;
  private startTime = Date.now();
  private lastProgressTime = Date.now();
  private lastProgressBytes = 0;

  constructor(
    private stream: ReadableStream<Uint8Array>,
    private config: StreamConfig = {},
    private handlers: StreamEventHandlers = {}
  ) {
    if (config.encoding) {
      this.decoder = new TextDecoder(config.encoding);
    }
  }

  /**
   * Start reading the stream
   */
  async start(): Promise<void> {
    if (!this.stream) {
      throw new Error('No stream available');
    }

    this.reader = this.stream.getReader();
    this.handlers.onStart?.();

    try {
      await this.readStream();
    } catch (error) {
      this.handlers.onError?.(error as Error);
      throw error;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Read stream chunks
   */
  private async readStream(): Promise<void> {
    if (!this.reader) return;

    while (true) {
      const { done, value } = await this.reader.read();

      if (done) {
        this.handlers.onComplete?.();
        break;
      }

      if (value) {
        this.totalBytes += value.length;
        
        const chunk: StreamChunk = {
          data: value,
          size: value.length,
          done: false,
          totalBytes: this.totalBytes
        };

        this.handlers.onChunk?.(chunk);
        this.updateProgress();

        // Backpressure handling
        if (this.config.backpressure && this.shouldApplyBackpressure()) {
          await this.applyBackpressure();
        }
      }
    }
  }

  /**
   * Update progress tracking
   */
  private updateProgress(): void {
    const now = Date.now();
    const timeDelta = now - this.lastProgressTime;
    const bytesDelta = this.totalBytes - this.lastProgressBytes;

    if (timeDelta >= 100) { // Update every 100ms
      const rate = bytesDelta / (timeDelta / 1000);
      const totalTime = now - this.startTime;
      
      const progress: StreamProgress = {
        loaded: this.totalBytes,
        total: this.getTotalSize(),
        lengthComputable: this.getTotalSize() > 0,
        bytes: this.totalBytes,
        rate,
        timeRemaining: this.estimateTimeRemaining(rate),
        direction: 'download'
      };

      this.handlers.onProgress?.(progress);
      this.lastProgressTime = now;
      this.lastProgressBytes = this.totalBytes;
    }
  }

  /**
   * Check if backpressure should be applied
   */
  private shouldApplyBackpressure(): boolean {
    const highWaterMark = this.config.highWaterMark || 65536; // 64KB default
    return this.totalBytes > highWaterMark;
  }

  /**
   * Apply backpressure by introducing a small delay
   */
  private async applyBackpressure(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  /**
   * Get total size if available from headers
   */
  private getTotalSize(): number {
    // This would be set from Content-Length header in actual implementation
    return 0;
  }

  /**
   * Estimate time remaining based on current rate
   */
  private estimateTimeRemaining(rate: number): number | undefined {
    const totalSize = this.getTotalSize();
    if (totalSize > 0 && rate > 0) {
      const remainingBytes = totalSize - this.totalBytes;
      return remainingBytes / rate;
    }
    return undefined;
  }

  /**
   * Convert chunk to text if decoder is available
   */
  chunkToText(chunk: StreamChunk): string | null {
    if (!this.decoder) return null;
    return this.decoder.decode(chunk.data, { stream: !chunk.done });
  }

  /**
   * Abort the stream
   */
  abort(): void {
    if (this.reader) {
      this.reader.cancel();
      this.handlers.onAbort?.();
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.reader) {
      this.reader.releaseLock();
      this.reader = null;
    }
  }
}

/**
 * Streaming request writer for upload streams
 */
export class StreamingRequestWriter {
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private totalBytes = 0;
  private startTime = Date.now();

  constructor(
    private stream: WritableStream<Uint8Array>,
    private config: StreamConfig = {},
    private handlers: StreamEventHandlers = {}
  ) {}

  /**
   * Start writing to the stream
   */
  async start(): Promise<void> {
    this.writer = this.stream.getWriter();
    this.handlers.onStart?.();
  }

  /**
   * Write data to the stream
   */
  async write(data: Uint8Array): Promise<void> {
    if (!this.writer) {
      throw new Error('Stream writer not initialized');
    }

    try {
      await this.writer.write(data);
      this.totalBytes += data.length;
      
      const chunk: StreamChunk = {
        data,
        size: data.length,
        done: false,
        totalBytes: this.totalBytes
      };

      this.handlers.onChunk?.(chunk);
      this.updateProgress();
    } catch (error) {
      this.handlers.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Close the stream
   */
  async close(): Promise<void> {
    if (this.writer) {
      await this.writer.close();
      this.handlers.onComplete?.();
      this.cleanup();
    }
  }

  /**
   * Update progress tracking
   */
  private updateProgress(): void {
    const now = Date.now();
    const rate = this.totalBytes / ((now - this.startTime) / 1000);
    
    const progress: StreamProgress = {
      loaded: this.totalBytes,
      total: 0, // Unknown for uploads unless specified
      lengthComputable: false,
      bytes: this.totalBytes,
      rate,
      direction: 'upload'
    };

    this.handlers.onProgress?.(progress);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.writer) {
      this.writer.releaseLock();
      this.writer = null;
    }
  }
}

/**
 * Utility functions for streaming operations
 */
export class StreamingUtils {
  /**
   * Create a readable stream from an array buffer
   */
  static createReadableStream(buffer: ArrayBuffer, chunkSize = 8192): ReadableStream<Uint8Array> {
    const bytes = new Uint8Array(buffer);
    let offset = 0;

    return new ReadableStream({
      start(controller) {
        const pump = () => {
          if (offset >= bytes.length) {
            controller.close();
            return;
          }

          const chunk = bytes.slice(offset, offset + chunkSize);
          controller.enqueue(chunk);
          offset += chunkSize;
        };

        pump();
      },

      pull(controller) {
        const pump = () => {
          if (offset >= bytes.length) {
            controller.close();
            return;
          }

          const chunk = bytes.slice(offset, offset + chunkSize);
          controller.enqueue(chunk);
          offset += chunkSize;
        };

        pump();
      }
    });
  }

  /**
   * Convert a readable stream to array buffer
   */
  static async streamToArrayBuffer(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    let totalLength = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        if (value) {
          chunks.push(value);
          totalLength += value.length;
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Combine all chunks into a single ArrayBuffer
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result.buffer;
  }

  /**
   * Convert a readable stream to text
   */
  static async streamToText(stream: ReadableStream<Uint8Array>, encoding = 'utf8'): Promise<string> {
    const decoder = new TextDecoder(encoding);
    const reader = stream.getReader();
    let result = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        if (value) {
          result += decoder.decode(value, { stream: true });
        }
      }
      
      // Final decode to handle any remaining bytes
      result += decoder.decode();
    } finally {
      reader.releaseLock();
    }

    return result;
  }

  /**
   * Create a transform stream for processing chunks
   */
  static createTransformStream<T, R>(
    transformer: (chunk: T) => R | Promise<R>
  ): TransformStream<T, R> {
    return new TransformStream({
      async transform(chunk, controller) {
        try {
          const result = await transformer(chunk);
          controller.enqueue(result);
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  /**
   * Split a stream into multiple streams (tee)
   */
  static teeStream<T>(stream: ReadableStream<T>): [ReadableStream<T>, ReadableStream<T>] {
    return stream.tee();
  }
}

/**
 * Stream-enabled request configuration
 */
export interface StreamingRequestConfig extends fluxhttpRequestConfig {
  /** Streaming configuration */
  streaming?: StreamConfig & StreamEventHandlers;
  /** Whether to enable request streaming */
  streamRequest?: boolean;
  /** Whether to enable response streaming */
  streamResponse?: boolean;
}

/**
 * Enhanced response with streaming capabilities
 */
export interface StreamingResponse<T = unknown> extends fluxhttpResponse<T> {
  /** Stream reader for response body */
  stream?: StreamingResponseReader;
  /** Original readable stream */
  body?: ReadableStream<Uint8Array>;
}

/**
 * Main streaming feature class
 */
export class StreamingFeature {
  /**
   * Enhance a request config with streaming capabilities
   */
  static enhanceRequestConfig(config: fluxhttpRequestConfig): StreamingRequestConfig {
    return {
      ...config,
      streaming: {
        chunkSize: 8192,
        backpressure: true,
        highWaterMark: 65536,
        autoClose: true,
        ...config.streaming
      }
    } as StreamingRequestConfig;
  }

  /**
   * Create a streaming response from a regular response
   */
  static createStreamingResponse<T>(
    response: fluxhttpResponse<T>,
    stream?: ReadableStream<Uint8Array>
  ): StreamingResponse<T> {
    const streamingResponse = response as StreamingResponse<T>;
    
    if (stream) {
      streamingResponse.body = stream;
      streamingResponse.stream = new StreamingResponseReader(
        stream,
        response.config.streaming || {},
        response.config.streaming || {}
      );
    }

    return streamingResponse;
  }

  /**
   * Check if streaming is supported in current environment
   */
  static isStreamingSupported(): boolean {
    return (
      typeof ReadableStream !== 'undefined' &&
      typeof WritableStream !== 'undefined' &&
      typeof TransformStream !== 'undefined'
    );
  }

  /**
   * Get streaming capabilities of current environment
   */
  static getStreamingCapabilities(): {
    readable: boolean;
    writable: boolean;
    transform: boolean;
    byob: boolean; // Bring Your Own Buffer
  } {
    return {
      readable: typeof ReadableStream !== 'undefined',
      writable: typeof WritableStream !== 'undefined',
      transform: typeof TransformStream !== 'undefined',
      byob: typeof ReadableStreamBYOBReader !== 'undefined'
    };
  }
}

export default StreamingFeature;