const Records = require("../models/records.model");
// FS => Para leer y eliminar archivos
const fs = require("fs");
// csv => Convierte cada linea csv en un objeto
const csv = require("csv-parser");
// Para manejar asincronia
const { promisify } = require("util");
// Para eliminar archivos temporales despues de procesarlo
const unlinkAsync = promisify(fs.unlink);

class RecordsService {
  constructor() {
    // Cantidad de registro a insertar
    this.BATCH_SIZE = 5000;
    // Tamaño máximo del archivo
    this.MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  }

  // Para validar cada registro
  validateRecord(record) {
    if (!record.id || isNaN(parseInt(record.id))) {
      throw new Error(`ID inválido: ${record.id}`);
    }
    if (!record.firstname || !record.lastname) {
      throw new Error(`Nombre o apellido faltante para ID: ${record.id}`);
    }
    if (!record.email || !record.email.includes("@")) {
      throw new Error(`Email inválido para ID: ${record.id}`);
    }
    return {
      id: parseInt(record.id),
      firstname: record.firstname,
      lastname: record.lastname,
      email: record.email,
      email2: record.email2 || "",
      profession: record.profession || "",
    };
  }

  async processFile(file) {
    if (file.size > this.MAX_FILE_SIZE) {
      await unlinkAsync(file.path); // Elimina el archivo temporal si es demasiado grande.
      throw new Error( // Lanza un error si el peso del archivo es mayor al permitido.
        `El archivo excede el tamaño máximo permitido de ${
          this.MAX_FILE_SIZE / (1024 * 1024)
        }MB`
      );
    }

    let recordsProcessed = 0; // Para contar cuántos registros se guardaron.
    let currentBatch = []; // Para agrupar registros antes de guardarlos en la base de datos.
    let totalRecords = 0; // Para contar todos los registros leídos del archivo.

    // Promesa para manejar el proceso de lectura y guardado del archivo.
    const processFile = new Promise((resolve, reject) => {
      // Crea un "stream" para leer el archivo poco a poco (para no llenar la memoria).
      fs.createReadStream(file.path)
        // Esto convierte cada línea del CSV en un objeto JavaScript.
        .pipe(csv())
        // Cuando el parser de CSV encuentra una línea (un "dato"):
        .on("data", async (data) => {
          try {
            // Valida que el registro tenga los datos correctos (ID, nombre, email, etc.)
            const validatedRecord = this.validateRecord(data);
            // Agrega el registro validado al lote actual.
            currentBatch.push(validatedRecord);
            // Incrementa el contador de registros leídos.
            totalRecords++;

            // Si el lote actual tiene 5000 registros o más:
            if (currentBatch.length >= this.BATCH_SIZE) {
              // Guarda estos 5000 registros en la base de datos de una vez.
              await Records.insertMany(currentBatch, { ordered: false });
              // Actualiza cuántos registros se han procesado exitosamente.
              recordsProcessed += currentBatch.length;
              // Vacía el lote para el siguiente grupo de registros.
              currentBatch = [];
            }
          } catch (error) {
            // Detiene el proceso y rechaza la promesa si hay un error.
            reject(error);
          }
        })
        // Cuando se termina de leer todo el archivo:
        .on("end", async () => {
          try {
            // Si quedan registros en el último lote (menos de 5000), los guarda también.
            if (currentBatch.length > 0) {
              await Records.insertMany(currentBatch, { ordered: false });
              recordsProcessed += currentBatch.length;
            }
            resolve();
          } catch (error) {
            // Detiene el proceso y rechaza la promesa si hay un error.
            reject(error);
          }
        })
        // Si hay algún error durante la lectura del archivo (ej. archivo corrupto):
        .on("error", (error) => {
          // Rechaza la promesa con el error.
          reject(error);
        });
    });

    // Espera a que todo el proceso de lectura y guardado del archivo termine.
    await processFile;
    // Una vez terminado, elimina el archivo temporal del disco para liberar espacio.
    await unlinkAsync(file.path);
    // Devuelve el número total de registros que se lograron guardar.
    return recordsProcessed;
  }

  async getLatestRecords(limit = 20) {
    // Ahora puedo pasar por props el limite de registros que quiero ver.
    return Records.find({}).limit(limit).lean();
  }
}

module.exports = new RecordsService();
