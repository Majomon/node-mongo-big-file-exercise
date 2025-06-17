const express = require("express");
const multer = require("multer");
const recordsController = require("../controllers/records.controller");

const router = express.Router();
const uploadFile = multer({ dest: "./_temp" });

router.post("/upload", uploadFile.single("file"), recordsController.upload);
router.get("/records", recordsController.list);

module.exports = router;
