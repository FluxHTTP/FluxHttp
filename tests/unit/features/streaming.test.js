/**
 * @fileoverview Tests for streaming features
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { 
  StreamingFeature, 
  StreamingResponseReader, 
  StreamingUtils 
} from '../../../src/features/streaming.js';

// Mock ReadableStream for Node.js environment
global.ReadableStream = global.ReadableStream || class ReadableStream {
  constructor(underlyingSource) {
    this.underlyingSource = underlyingSource;
    this._reader = null;
  }
  
  getReader() {
    if (this._reader) throw new Error('ReadableStream is locked');
    this._reader = new ReadableStreamDefaultReader(this);
    return this._reader;
  }
  
  tee() {
    return [new ReadableStream(this.underlyingSource), new ReadableStream(this.underlyingSource)];
  }
};

global.ReadableStreamDefaultReader = global.ReadableStreamDefaultReader || class ReadableStreamDefaultReader {
  constructor(stream) {
    this.stream = stream;
    this.closed = false;
  }
  
  async read() {
    if (this.closed) return { done: true, value: undefined };
    // Mock implementation
    return { done: true, value: undefined };
  }
  
  releaseLock() {
    this.stream._reader = null;
  }
  
  cancel() {
    this.closed = true;
  }
};

describe('StreamingFeature', () => {
  it('should check streaming support', () => {
    const isSupported = StreamingFeature.isStreamingSupported();
    assert.strictEqual(typeof isSupported, 'boolean');
  });

  it('should get streaming capabilities', () => {
    const capabilities = StreamingFeature.getStreamingCapabilities();
    assert.strictEqual(typeof capabilities.readable, 'boolean');
    assert.strictEqual(typeof capabilities.writable, 'boolean');
    assert.strictEqual(typeof capabilities.transform, 'boolean');
    assert.strictEqual(typeof capabilities.byob, 'boolean');
  });

  it('should enhance request config', () => {
    const config = { url: 'https://example.com' };
    const enhanced = StreamingFeature.enhanceRequestConfig(config);
    
    assert.strictEqual(enhanced.url, config.url);
    assert.strictEqual(typeof enhanced.streaming, 'object');
    assert.strictEqual(enhanced.streaming.chunkSize, 8192);
    assert.strictEqual(enhanced.streaming.backpressure, true);
  });
});

describe('StreamingUtils', () => {
  it('should create readable stream from ArrayBuffer', () => {
    const buffer = new ArrayBuffer(1024);
    const stream = StreamingUtils.createReadableStream(buffer);
    
    assert.ok(stream instanceof ReadableStream);
  });

  it('should tee stream', () => {
    const buffer = new ArrayBuffer(1024);
    const stream = StreamingUtils.createReadableStream(buffer);
    const [stream1, stream2] = StreamingUtils.teeStream(stream);
    
    assert.ok(stream1 instanceof ReadableStream);
    assert.ok(stream2 instanceof ReadableStream);
  });

  it('should create transform stream', () => {
    const transformer = (chunk) => chunk;
    const transformStream = StreamingUtils.createTransformStream(transformer);
    
    assert.ok(transformStream);
    assert.strictEqual(typeof transformStream.transform, 'function');
  });
});

describe('StreamingResponseReader', () => {
  it('should create reader with config', () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.close();
      }
    });
    
    const config = { chunkSize: 4096 };
    const handlers = {};
    
    const reader = new StreamingResponseReader(mockStream, config, handlers);
    assert.ok(reader);
  });

  it('should convert chunk to text with decoder', () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.close();
      }
    });
    
    const config = { encoding: 'utf8' };
    const reader = new StreamingResponseReader(mockStream, config);
    
    const chunk = {
      data: new Uint8Array([72, 101, 108, 108, 111]), // "Hello"
      size: 5,
      done: false,
      totalBytes: 5
    };
    
    const text = reader.chunkToText(chunk);
    assert.strictEqual(text, 'Hello');
  });
});