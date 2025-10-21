require("dotenv-safe").load();
const express = require("express");
const router = express.Router();
const Reports = require("../handlers/reportsHandler");
const ErrorHandler = require("../handlers/errorHandler");
const ReportService = require("../services/reports.service");
const bodySchema = require("../utils/schemas/report-post.schema");
const { Constants } = require("../utils/constants");

//========== GET ==========
//Get reports
router.get("/", (req, res, next) => {
  var context = "GET /api/private/reports";
  try {
    let { client, component } = req.headers;

    if (
      Constants.reports.clients.includes(client) ||
      Constants.reports.clients.includes(component)
    ) {
      Reports.getReportsWeb(req, res)
        .then((result) => {
          return res.status(200).send(result);
        })
        .catch((error) => {
          console.error(
            `[${context}][Reports.getReportsWeb] Error `,
            error.message,
          );
          ErrorHandler.ErrorHandler(error, res);
        });
    } else {
      Reports.getReportsApps(req, res)
        .then((result) => {
          return res.status(200).send(result);
        })
        .catch((error) => {
          console.error(
            `[${context}][Reports.getReportsApps] Error `,
            error.message,
          );
          ErrorHandler.ErrorHandler(error, res);
        });
    }
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    ErrorHandler.ErrorHandler(error, res);
  }
});

router.post("/", async (req, res) => {
  var context = "POST /api/private/reports";
  try {
    const { error } = bodySchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      });
    }

    await ReportService.publish(req.body);
    return res.status(201).send("Created");
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    ErrorHandler.ErrorHandler(error, res);
  }
});

module.exports = router;
