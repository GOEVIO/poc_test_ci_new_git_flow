import { describe, expect, it, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import router from "../../controllers/language-v2.controller";
import { FileTranslationService } from "../../services/file.translaction";
import commons from "evio-library-commons";
import Sentry from "@sentry/node";

// Mock dependencies
vi.mock("../services/file.translaction");
vi.mock("evio-library-commons");
vi.mock("@sentry/node");

const { ErrorHandlerCommon, Enums } = commons;
const { StatusCodeHttp } = Enums;

describe("Language Router", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseObject: any;

  beforeEach(() => {
    // Reset mocks and test variables
    vi.resetAllMocks();
    responseObject = {};

    // Setup mock response
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockImplementation((payload) => {
        responseObject = payload;
        return mockResponse;
      }),
    };
  });

  describe("GET /api/public/language/v2/components/:projectName/:componentName/translations/", () => {
    it("should return translations when valid parameters are provided", async () => {
      // Arrange
      const mockTranslations = { language: "pt_PT" };
      vi.mocked(
        FileTranslationService.retrieveFileTranslationMetadata
      ).mockResolvedValue(JSON.stringify(mockTranslations));

      mockRequest = {
        params: {
          projectName: "test-project",
          componentName: "test-component",
        },
      };

      // Assert
      expect(
        FileTranslationService.retrieveFileTranslationMetadata
      ).toHaveBeenCalledWith("test-component", "test-project");
      expect(mockResponse.status).toHaveBeenCalledWith(StatusCodeHttp.OK);
      expect(responseObject).toEqual(mockTranslations);
    });

    it("should return 400 when parameters are missing", async () => {
      // Arrange
      mockRequest = {
        params: {
          projectName: "",
          componentName: "",
        },
      };

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(
        StatusCodeHttp.BAD_REQUEST
      );
      expect(responseObject).toEqual({
        auth: false,
        code: "server_bad_request",
        message: "Component or project not found",
      });
    });

    it("should handle errors and return appropriate status code", async () => {
      // Arrange
      const mockError = {
        status: StatusCodeHttp.NOT_FOUND,
        auth: true,
        code: "not_found",
        message: "Not found",
      };
      vi.mocked(
        FileTranslationService.retrieveFileTranslationMetadata
      ).mockRejectedValue(mockError);

      mockRequest = {
        params: {
          projectName: "test-project",
          componentName: "test-component",
        },
      };

      // Assert
      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(
        StatusCodeHttp.NOT_FOUND
      );
      expect(responseObject).toEqual({
        auth: true,
        code: "not_found",
        message: "Not found",
      });
    });

    it("should capture internal server errors in Sentry", async () => {
      // Arrange
      const mockError = {
        status: StatusCodeHttp.INTERNAL_SERVER_ERROR,
        message: "Server error",
      };
      vi.mocked(
        FileTranslationService.retrieveFileTranslationMetadata
      ).mockRejectedValue(mockError);

      mockRequest = {
        params: {
          projectName: "test-project",
          componentName: "test-component",
        },
      };

      // Assert
      expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
      expect(mockResponse.status).toHaveBeenCalledWith(
        StatusCodeHttp.INTERNAL_SERVER_ERROR
      );
      expect(responseObject).toEqual({
        auth: false,
        code: "server_error",
        message: "Server error",
      });
    });
  });

  describe("GET /api/public/language/v2/components/:projectName/:componentName/:lang/file/", () => {
    it("should return translation file when valid parameters are provided", async () => {
      // Arrange
      const mockTranslation = { key: "value" };
      vi.mocked(
        FileTranslationService.retrieveFileTranslationByLanguage
      ).mockResolvedValue(mockTranslation);

      mockRequest = {
        params: {
          projectName: "test-project",
          componentName: "test-component",
          lang: "en",
        },
        headers: {
          clientname: "test-client",
        },
        query: {
          metadata: "true",
        },
      };

      // Assert
      expect(
        FileTranslationService.retrieveFileTranslationByLanguage
      ).toHaveBeenCalledWith("test-component", "test-project", "en");
      expect(mockResponse.status).toHaveBeenCalledWith(StatusCodeHttp.OK);
      expect(responseObject).toEqual(mockTranslation);
    });

    it("should return 400 when required parameters are missing", async () => {
      // Arrange
      mockRequest = {
        params: {
          projectName: "",
          componentName: "",
          lang: "",
        },
      };

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(
        StatusCodeHttp.BAD_REQUEST
      );
      expect(responseObject).toEqual({
        auth: false,
        code: "server_bad_request",
        message: "Component or project or language not found",
      });
    });

    it("should handle errors and include clientname in logs", async () => {
      // Arrange
      const mockError = {
        status: StatusCodeHttp.NOT_FOUND,
        message: "Not found",
      };
      vi.mocked(
        FileTranslationService.retrieveFileTranslationByLanguage
      ).mockRejectedValue(mockError);
      const consoleSpy = vi.spyOn(console, "error");

      mockRequest = {
        params: {
          projectName: "test-project",
          componentName: "test-component",
          lang: "en",
        },
        headers: {
          clientname: "test-client",
        },
      };

      // Assert
      expect(consoleSpy).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(
        StatusCodeHttp.NOT_FOUND
      );
      expect(responseObject).toEqual({
        auth: false,
        code: "server_error",
        message: "Not found",
      });
    });
  });
});
