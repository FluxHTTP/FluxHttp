import { test, expect, testData } from '../utils/fixtures';
import path from 'path';

test.describe('File Operations', () => {
  test.describe('File Upload', () => {
    test('should upload single file successfully', async ({ 
      fileHelper, 
      fluxHttpHelpers 
    }) => {
      const result = await fileHelper.uploadFile('tests/e2e/static/test-upload.txt');
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        filename: expect.stringMatching(/^\d+-test-upload\.txt$/),
        originalName: 'test-upload.txt',
        size: expect.any(Number),
        mimetype: 'text/plain'
      });
      expect(result.data.size).toBeGreaterThan(0);
    });

    test('should handle large file upload', async ({ 
      fileHelper 
    }) => {
      const result = await fileHelper.uploadFile('tests/e2e/static/large-test-file.txt');
      
      expect(result.success).toBe(true);
      expect(result.data.size).toBeGreaterThan(100000); // Should be > 100KB
    });

    test('should upload multiple files', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const formData = new FormData();
        
        // Create multiple test files
        const file1 = new Blob(['Test file 1 content'], { type: 'text/plain' });
        const file2 = new Blob(['Test file 2 content'], { type: 'text/plain' });
        
        formData.append('files', file1, 'test1.txt');
        formData.append('files', file2, 'test2.txt');
        
        try {
          const response = await window.fluxHttpInstance.post('/files/upload-multiple', formData);
          return { success: true, data: response.data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.data.files).toHaveLength(2);
      expect(result.data.files[0]).toMatchObject({
        originalName: 'test1.txt',
        mimetype: 'text/plain'
      });
      expect(result.data.files[1]).toMatchObject({
        originalName: 'test2.txt',
        mimetype: 'text/plain'
      });
    });

    test('should handle upload with progress tracking', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const formData = new FormData();
        const largeContent = 'x'.repeat(50000); // 50KB file
        const file = new Blob([largeContent], { type: 'text/plain' });
        formData.append('file', file, 'large-upload.txt');
        
        let progressEvents = [];
        
        try {
          const response = await window.fluxHttpInstance.post('/files/upload', formData, {
            onUploadProgress: (progressEvent) => {
              progressEvents.push({
                loaded: progressEvent.loaded,
                total: progressEvent.total,
                percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total)
              });
            }
          });
          
          return { 
            success: true, 
            data: response.data,
            progressEvents
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.progressEvents.length).toBeGreaterThan(0);
      
      // Check that progress increased over time
      const firstProgress = result.progressEvents[0];
      const lastProgress = result.progressEvents[result.progressEvents.length - 1];
      expect(lastProgress.loaded).toBeGreaterThanOrEqual(firstProgress.loaded);
      expect(lastProgress.percentage).toBe(100);
    });

    test('should handle upload failure gracefully', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Try to upload to non-existent endpoint
        const formData = new FormData();
        const file = new Blob(['test'], { type: 'text/plain' });
        formData.append('file', file, 'test.txt');
        
        try {
          const response = await window.fluxHttpInstance.post('/files/non-existent', formData);
          return { success: true, data: response.data };
        } catch (error) {
          return { 
            success: false, 
            error: {
              message: error.message,
              status: error.response?.status,
              data: error.response?.data
            }
          };
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(404);
    });

    test('should handle empty file upload', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const formData = new FormData();
        // Don't add any file
        
        try {
          const response = await window.fluxHttpInstance.post('/files/upload', formData);
          return { success: true, data: response.data };
        } catch (error) {
          return { 
            success: false, 
            error: {
              message: error.message,
              status: error.response?.status,
              data: error.response?.data
            }
          };
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(400);
      expect(result.error.data.error).toContain('No file uploaded');
    });
  });

  test.describe('File Download', () => {
    test('should download file successfully', async ({ 
      fileHelper, 
      fluxHttpHelpers 
    }) => {
      // First upload a file
      const uploadResult = await fileHelper.uploadFile('tests/e2e/static/test-upload.txt');
      expect(uploadResult.success).toBe(true);
      
      const filename = uploadResult.data.filename;
      
      // Then download it
      const downloadResult = await fileHelper.downloadFile(filename);
      
      expect(downloadResult.success).toBe(true);
      expect(downloadResult.status).toBe(200);
    });

    test('should handle download of non-existent file', async ({ 
      fileHelper 
    }) => {
      const result = await fileHelper.downloadFile('non-existent-file.txt');
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(404);
    });

    test('should download large file with progress tracking', async ({ 
      fluxHttpHelpers 
    }) => {
      // First upload a large file
      const uploadResult = await fluxHttpHelpers.page.evaluate(async () => {
        const formData = new FormData();
        const largeContent = 'x'.repeat(100000); // 100KB file
        const file = new Blob([largeContent], { type: 'text/plain' });
        formData.append('file', file, 'large-download-test.txt');
        
        try {
          const response = await window.fluxHttpInstance.post('/files/upload', formData);
          return { success: true, data: response.data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(uploadResult.success).toBe(true);
      const filename = uploadResult.data.filename;
      
      // Download with progress tracking
      const downloadResult = await fluxHttpHelpers.page.evaluate(async (filename) => {
        let progressEvents = [];
        
        try {
          const response = await window.fluxHttpInstance.get(`/files/download/${filename}`, {
            responseType: 'blob',
            onDownloadProgress: (progressEvent) => {
              progressEvents.push({
                loaded: progressEvent.loaded,
                total: progressEvent.total,
                percentage: progressEvent.total 
                  ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                  : 0
              });
            }
          });
          
          return { 
            success: true, 
            data: response.data,
            progressEvents,
            size: response.data.size
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, filename);
      
      expect(downloadResult.success).toBe(true);
      expect(downloadResult.progressEvents.length).toBeGreaterThan(0);
    });
  });

  test.describe('File Type Handling', () => {
    test('should handle different file types', async ({ 
      fluxHttpHelpers 
    }) => {
      const fileTypes = [
        { content: 'Text file content', type: 'text/plain', name: 'test.txt' },
        { content: '{"data": "json content"}', type: 'application/json', name: 'test.json' },
        { content: '<html><body>HTML content</body></html>', type: 'text/html', name: 'test.html' }
      ];
      
      for (const fileType of fileTypes) {
        const result = await fluxHttpHelpers.page.evaluate(async (fileType) => {
          const formData = new FormData();
          const file = new Blob([fileType.content], { type: fileType.type });
          formData.append('file', file, fileType.name);
          
          try {
            const response = await window.fluxHttpInstance.post('/files/upload', formData);
            return { success: true, data: response.data };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }, fileType);
        
        expect(result.success).toBe(true);
        expect(result.data.originalName).toBe(fileType.name);
        expect(result.data.mimetype).toBe(fileType.type);
      }
    });

    test('should handle binary files', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Create a simple binary file (simulated image)
        const binaryData = new Uint8Array([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
          ...Array.from({ length: 100 }, () => Math.floor(Math.random() * 256))
        ]);
        
        const formData = new FormData();
        const file = new Blob([binaryData], { type: 'image/png' });
        formData.append('file', file, 'test.png');
        
        try {
          const response = await window.fluxHttpInstance.post('/files/upload', formData);
          return { success: true, data: response.data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.data.mimetype).toBe('image/png');
      expect(result.data.originalName).toBe('test.png');
    });
  });

  test.describe('File Size Limits', () => {
    test('should respect file size limits', async ({ 
      fluxHttpHelpers 
    }) => {
      // Test with file larger than server limit (10MB)
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Create file larger than 10MB limit
        const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
        const formData = new FormData();
        const file = new Blob([largeContent], { type: 'text/plain' });
        formData.append('file', file, 'too-large.txt');
        
        try {
          const response = await window.fluxHttpInstance.post('/files/upload', formData);
          return { success: true, data: response.data };
        } catch (error) {
          return { 
            success: false, 
            error: {
              message: error.message,
              status: error.response?.status,
              data: error.response?.data
            }
          };
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(413); // Payload Too Large
    });

    test('should handle maximum allowed file size', async ({ 
      fluxHttpHelpers 
    }) => {
      // Test with file at the limit (just under 10MB)
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const maxContent = 'x'.repeat(9 * 1024 * 1024); // 9MB - under limit
        const formData = new FormData();
        const file = new Blob([maxContent], { type: 'text/plain' });
        formData.append('file', file, 'max-size.txt');
        
        try {
          const response = await window.fluxHttpInstance.post('/files/upload', formData);
          return { success: true, data: response.data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.data.size).toBeGreaterThan(8 * 1024 * 1024); // Should be around 9MB
    });
  });

  test.describe('Concurrent File Operations', () => {
    test('should handle multiple concurrent uploads', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const uploadPromises = Array.from({ length: 5 }, (_, i) => {
          const formData = new FormData();
          const file = new Blob([`File ${i} content`], { type: 'text/plain' });
          formData.append('file', file, `concurrent-${i}.txt`);
          
          return window.fluxHttpInstance.post('/files/upload', formData);
        });
        
        try {
          const responses = await Promise.all(uploadPromises);
          return {
            success: true,
            results: responses.map(r => r.data)
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(5);
      
      // Verify all uploads succeeded and have unique filenames
      result.results.forEach((uploadResult, i) => {
        expect(uploadResult.originalName).toBe(`concurrent-${i}.txt`);
        expect(uploadResult.filename).toBeTruthy();
      });
      
      const filenames = result.results.map(r => r.filename);
      const uniqueFilenames = new Set(filenames);
      expect(uniqueFilenames.size).toBe(filenames.length);
    });

    test('should handle mixed upload and download operations', async ({ 
      fluxHttpHelpers 
    }) => {
      // First upload some files
      const uploadResults = await fluxHttpHelpers.page.evaluate(async () => {
        const uploadPromises = Array.from({ length: 3 }, (_, i) => {
          const formData = new FormData();
          const file = new Blob([`Mixed operation file ${i}`], { type: 'text/plain' });
          formData.append('file', file, `mixed-${i}.txt`);
          
          return window.fluxHttpInstance.post('/files/upload', formData);
        });
        
        const responses = await Promise.all(uploadPromises);
        return responses.map(r => r.data);
      });
      
      // Then perform mixed operations
      const mixedResults = await fluxHttpHelpers.page.evaluate(async (filenames) => {
        const operations = [
          // Download existing files
          ...filenames.map(filename => 
            window.fluxHttpInstance.get(`/files/download/${filename}`)
          ),
          // Upload new files
          ...Array.from({ length: 2 }, (_, i) => {
            const formData = new FormData();
            const file = new Blob([`New file ${i}`], { type: 'text/plain' });
            formData.append('file', file, `new-mixed-${i}.txt`);
            return window.fluxHttpInstance.post('/files/upload', formData);
          })
        ];
        
        try {
          const results = await Promise.all(operations);
          return {
            success: true,
            downloadCount: filenames.length,
            uploadCount: 2,
            totalOperations: results.length
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, uploadResults.map(r => r.filename));
      
      expect(mixedResults.success).toBe(true);
      expect(mixedResults.totalOperations).toBe(5); // 3 downloads + 2 uploads
    });
  });

  test.describe('File Operation Error Handling', () => {
    test('should handle network errors during upload', async ({ 
      fluxHttpHelpers 
    }) => {
      // Start upload then simulate network failure
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const formData = new FormData();
        const file = new Blob(['test content'], { type: 'text/plain' });
        formData.append('file', file, 'network-fail.txt');
        
        // Simulate network failure by using invalid URL
        try {
          const response = await window.fluxHttpInstance.post('http://invalid-domain.test/files/upload', formData);
          return { success: true, data: response.data };
        } catch (error) {
          return { 
            success: false, 
            error: {
              message: error.message,
              isNetworkError: true
            }
          };
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error.isNetworkError).toBe(true);
    });

    test('should handle upload timeout', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const formData = new FormData();
        const file = new Blob(['test content'], { type: 'text/plain' });
        formData.append('file', file, 'timeout-test.txt');
        
        try {
          const response = await window.fluxHttpInstance.post('/files/upload', formData, {
            timeout: 1 // Very short timeout
          });
          return { success: true, data: response.data };
        } catch (error) {
          return { 
            success: false, 
            error: {
              message: error.message,
              isTimeout: error.code === 'ECONNABORTED' || error.message.includes('timeout')
            }
          };
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error.isTimeout).toBe(true);
    });
  });
});