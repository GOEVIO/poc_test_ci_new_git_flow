import { describe, expect, it, vi, beforeEach } from "vitest";
import libraryLanguage from "evio-library-language";
import { FileTranslationService } from "../../services/file.translaction";

// Mock the entire library
vi.mock("evio-library-language");

const { FileTransaction } = libraryLanguage;

describe("FileTranslationService", () => {
  const mockProjectName = "test-project";
  const mockComponentName = "test-component";
  const mockLang = "en";
  const mockTranslation = { key: "value" };
  const mockHash = "abc123hash";

  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();

    // Mock console.error to track errors
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("retrieveFileTranslationMetadata", () => {
    it("should return translation when successful", async () => {
      // Arrange
      vi.mocked(
        FileTransaction.retrieveFileTranslationMetadata
      ).mockResolvedValue(mockTranslation);

      // Act
      const result =
        await FileTranslationService.retrieveFileTranslationMetadata(
          mockProjectName,
          mockComponentName
        );

      // Assert
      expect(
        FileTransaction.retrieveFileTranslationMetadata
      ).toHaveBeenCalledWith(mockProjectName, mockComponentName);
      expect(result).toEqual(mockTranslation);
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should throw error when library fails", async () => {
      // Arrange
      const mockError = new Error("Library failed");
      vi.mocked(
        FileTransaction.retrieveFileTranslationMetadata
      ).mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        FileTranslationService.retrieveFileTranslationMetadata(
          mockProjectName,
          mockComponentName
        )
      ).rejects.toThrow("Library failed");

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "[retrieveFileTranslationMetadata] Error: Library failed"
        )
      );
    });
  });

  describe("retrieveFileTransactionByLanguage", () => {
    it("should return translation with hash when successful", async () => {
      // Arrange
      vi.mocked(
        FileTransaction.retrieveFileTranslationByLanguage
      ).mockResolvedValue(mockTranslation);
      vi.mocked(FileTransaction.setupHashTranslation).mockResolvedValue({
        translationHash: mockHash,
      });

      // Act
      const result =
        await FileTranslationService.retrieveFileTranslationByLanguage(
          mockProjectName,
          mockComponentName,
          mockLang
        );

      // Assert
      expect(
        FileTransaction.retrieveFileTranslationByLanguage
      ).toHaveBeenCalledWith(mockProjectName, mockComponentName, mockLang);
      expect(FileTransaction.setupHashTranslation).toHaveBeenCalledWith(
        mockTranslation
      );
      expect(result).toEqual({
        language: { translationHash: mockHash },
        translation: mockTranslation,
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should throw error when translation retrieval fails", async () => {
      // Arrange
      const mockError = new Error("Translation failed");
      vi.mocked(
        FileTransaction.retrieveFileTranslationByLanguage
      ).mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        FileTranslationService.retrieveFileTranslationByLanguage(
          mockProjectName,
          mockComponentName,
          mockLang
        )
      ).rejects.toThrow("Translation failed");

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "[retrieveFileTranslationMetadata] Error: Translation failed"
        )
      );
      expect(FileTransaction.setupHashTranslation).not.toHaveBeenCalled();
    });

    it("should throw error when hash generation fails", async () => {
      // Arrange
      const mockError = new Error("Hash failed");
      vi.mocked(
        FileTransaction.retrieveFileTranslationByLanguage
      ).mockResolvedValue(mockTranslation);
      vi.mocked(FileTransaction.setupHashTranslation).mockRejectedValue(
        mockError
      );

      // Act & Assert
      await expect(
        FileTranslationService.retrieveFileTranslationByLanguage(
          mockProjectName,
          mockComponentName,
          mockLang
        )
      ).rejects.toThrow("Hash failed");

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "[retrieveFileTranslationMetadata] Error: Hash failed"
        )
      );
    });

    it("should maintain context in error messages", async () => {
      // Arrange
      const mockError = new Error("Test error");
      vi.mocked(
        FileTransaction.retrieveFileTranslationByLanguage
      ).mockRejectedValue(mockError);

      // Act
      try {
        await FileTranslationService.retrieveFileTranslationByLanguage(
          mockProjectName,
          mockComponentName,
          mockLang
        );
      } catch (error) {
        // Assert
        expect(error.message).toBe("Test error");
        expect(console.error).toHaveBeenCalledWith(
          "[retrieveFileTranslationByLanguage] Error: Test error"
        );
      }
    });
  });
});
