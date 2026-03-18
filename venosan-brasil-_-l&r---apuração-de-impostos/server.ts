import express from "express";
console.log("Server file loaded");
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import * as XLSX from "xlsx";
import JSZip from "jszip";

const app = express();
const PORT = 3000;
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Constants from Python script
const CFOP_ST = [6.403, 6.401, 5.403, 5.401];
const NACIONAL_ALIQ = [12.0];
const IMPORTADO_ALIQ = [4.0];

// State configurations: [MVA_IMPORTADO, MVA_NACIONAL, ALIQUOTA, REDUCAO/FCP]
const STATE_CONFIGS: Record<string, any> = {
  PE: { mvaImp: 1.4134, mvaNac: 1.4134, aliq: 20.50 },
  BA: { mvaImp: 1.7072, mvaNac: 1.5650, aliq: 20.50 },
  ES: { mvaImp: 1.6348, mvaNac: 1.4985, aliq: 17 },
  MA: { mvaImp: 1.7396, mvaNac: 1.5946, aliq: 23 },
  MT: { mvaImp: 1.6035, mvaNac: 1.6035, aliq: 17 },
  PB: { mvaImp: 1.6661, mvaNac: 1.5547, aliq: 20 },
  PR: { aliq: 19.50 },
  RS: { mvaImp: 1.9153, mvaNac: 1.7557, aliq: 17 },
  GO: { aliq: 19 },
  MG: { aliq: 18 },
  SC: { aliq: 17 },
  SP: { aliq: 18 },
  RN: { mvaImp: 1.6961, mvaNac: 1.5547, aliq: 20, reducao: 10 },
  PA: { mvaImp: 0.6751, mvaNac: 0.5355, aliq: 19, reducao: 0.3684 },
  AL: { mvaImp: 1.6751, mvaNac: 1.5355, aliq: 19, fcp: 0.01 },
  RJ: { mvaImp: 1.6970, mvaNac: 1.5556, aliq: 20, fcp: 0.02 },
};

// In-memory storage for processed results (for demo purposes)
let processedResults: Record<string, any> = {};

app.use(express.json());

app.get("/api/test", (req, res) => {
  res.json({ message: "API is working" });
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  console.log("Received upload request");
  if (!req.file) {
    console.log("No file in request");
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    console.log("Processing file:", req.file.originalname);
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Global filter by SERIE
    const filteredData = data.filter((row: any) => {
      const serie = parseFloat(row.SERIE);
      return serie === 1.0 || serie === 4.0;
    });

    const resultsByState: Record<string, { st: any[]; difal: any[] }> = {};
    Object.keys(STATE_CONFIGS).forEach((state) => {
      resultsByState[state] = { st: [], difal: [] };
    });

    const ONLY_DIFAL_STATES = ["GO", "MG", "PR", "SC", "SP"];

    filteredData.forEach((row: any) => {
      const state = String(row.UF).toUpperCase();
      if (!STATE_CONFIGS[state]) return;

      const config = STATE_CONFIGS[state];
      const natOperacao = parseFloat(row.NAT_OPERACAO);
      
      // ST Filter: Only if state is NOT in ONLY_DIFAL_STATES
      const isST = CFOP_ST.includes(natOperacao) && !ONLY_DIFAL_STATES.includes(state);
      
      // DIFAL Filter: Generally ESTADUAL == " ", but MG has a special rule
      let isDifal = false;
      if (state === "MG") {
        isDifal = (parseFloat(row.V_ICMS_UF_DEST) || 0) > 0;
      } else {
        isDifal = row.ESTADUAL === " ";
      }

      // Nationality logic
      let nacionalidade = "";
      const aliq = parseFloat(row.ALIQ);
      if (NACIONAL_ALIQ.includes(aliq)) nacionalidade = "Nacional";
      else if (IMPORTADO_ALIQ.includes(aliq)) nacionalidade = "Importado";
      else if (state === "PE") nacionalidade = "Pernambuco";

      if (isST) {
        let bcSt = 0;
        const baseCalculo = parseFloat(row.BASECALCULO) || 0;
        const vlrObsIcmss = parseFloat(row.VLR_OBS_ICMSS) || 0;
        const vFcpSt = parseFloat(row.V_FCPST) || 0;

        // Base Calculation logic
        if (state === "RN") {
          const mva = nacionalidade === "Nacional" ? config.mvaNac : config.mvaImp;
          bcSt = baseCalculo * mva - baseCalculo * (mva / config.reducao);
        } else if (state === "PA") {
          const mva = nacionalidade === "Nacional" ? config.mvaNac : config.mvaImp;
          bcSt = (baseCalculo * mva + baseCalculo) - (baseCalculo * mva + baseCalculo) * config.reducao;
        } else if (state === "PE") {
          bcSt = baseCalculo * config.mvaNac; 
        } else {
          const mva = nacionalidade === "Nacional" ? config.mvaNac : config.mvaImp;
          bcSt = baseCalculo * (mva || 1);
        }

        const stRow: any = {
          NF: row.NUMERO_NOTA,
          DATA: row.DATA,
          CFOP: row.NAT_OPERACAO,
          UF: state,
          "INSCRIÇÃO ESTADUAL": row.ESTADUAL,
          "BC ST": bcSt,
          "VL ICMS ST": vlrObsIcmss,
          "VL DO PROD.": baseCalculo,
          "VL TOTAL NF": vlrObsIcmss + baseCalculo,
        };

        // Special fields for RJ and AL
        if (state === "RJ" || state === "AL") {
          stRow["VL TOTAL NF"] = vlrObsIcmss + baseCalculo + vFcpSt;
          stRow["FCP"] = vFcpSt;
        }

        resultsByState[state].st.push(stRow);
      }

      if (isDifal) {
        const vlProd = parseFloat(row.VALOR_TOTAL) || parseFloat(row.BASECALCULO) || 0;
        const aliqIcms = parseFloat(row.ALIQ) || 0;
        const vIcmsUfDest = parseFloat(row.V_ICMS_UF_DEST) || 0;
        const vFcpUfDest = parseFloat(row.V_FCP_UF_DEST) || 0;
        const apuracao = parseFloat(row.APURACAO) || 0;

        // Difal Calculation logic
        const targetAliq = config.aliq || 0;
        const difalCalc = vlProd * ((targetAliq - aliqIcms) / 100);

        const difalRow: any = {
          NF: row.NUMERO_NOTA,
          DATA: row.DATA,
          CFOP: row.NAT_OPERACAO,
          UF: state,
          "ALIQ. ICMS": aliqIcms,
          "INSCRIÇÃO ESTADUAL": row.ESTADUAL,
          "VL ICMS": apuracao,
          DIFAL: vIcmsUfDest,
          "Cálculo do Imposto (Difal)": difalCalc,
          "VL DO PROD.": vlProd,
          "VL TOTAL NF": vlProd,
        };

        // Special fields for RJ and AL
        if (state === "RJ" || state === "AL") {
          difalRow["FCP"] = vFcpUfDest;
          difalRow["Cálculo do Imposto(FCP)"] = vlProd * (config.fcp || 0);
        }

        resultsByState[state].difal.push(difalRow);
      }
    });

    const processId = Date.now().toString();
    processedResults[processId] = resultsByState;

    res.json({ processId, states: Object.keys(resultsByState).filter(s => resultsByState[s].st.length > 0 || resultsByState[s].difal.length > 0) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process file" });
  }
});

app.get("/api/download/:processId/:state/:type", (req, res) => {
  const { processId, state, type } = req.params;
  const results = processedResults[processId];

  if (!results || !results[state]) {
    return res.status(404).send("Not found");
  }

  const data = type === "st" ? results[state].st : results[state].difal;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, type.toUpperCase());

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Disposition", `attachment; filename=${state}_${type.toUpperCase()}.xlsx`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
});

app.get("/api/download-all/:processId", async (req, res) => {
  const { processId } = req.params;
  const results = processedResults[processId];

  if (!results) {
    return res.status(404).send("Not found");
  }

  const zip = new JSZip();

  for (const state of Object.keys(results)) {
    const { st, difal } = results[state];

    if (st.length > 0) {
      const ws = XLSX.utils.json_to_sheet(st);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "ST");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      zip.file(`${state}_ST.xlsx`, buffer);
    }

    if (difal.length > 0) {
      const ws = XLSX.utils.json_to_sheet(difal);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DIFAL");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      zip.file(`${state}_DIFAL.xlsx`, buffer);
    }
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  res.setHeader("Content-Disposition", `attachment; filename=Apuracoes_Completo_${processId}.zip`);
  res.setHeader("Content-Type", "application/zip");
  res.send(zipBuffer);
});

async function startServer() {
  console.log("Starting server...");
  // Catch-all for /api that returns JSON (if no other /api route matched)
  app.all("/api/*", (req, res, next) => {
    if (res.headersSent) return next();
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
  });

  // Error handling middleware for API
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("API error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
