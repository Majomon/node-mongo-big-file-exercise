const recordsService = require("../services/records.service");

const upload = async (req, res) => {
  const { file } = req;

  if (!file) {
    return res.status(400).json({ error: "No se proporcionó ningún archivo" });
  }

  try {
    const recordsProcessed = await recordsService.processFile(file);
    return res.status(200).json({
      message: "Archivo procesado exitosamente",
      recordsProcessed,
    });
  } catch (error) {
    console.error("Error procesando archivo:", error);
    let statusCode = 500;
    if (error.message.includes("El archivo excede el tamaño máximo")) {
      statusCode = 400;
    }
    return res.status(statusCode).json({
      error: "Error procesando el archivo",
      details: error.message,
    });
  }
};

const list = async (_, res) => {
  try {
    const data = await recordsService.getLatestRecords();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json(err);
  }
};

module.exports = {
  upload,
  list,
};
