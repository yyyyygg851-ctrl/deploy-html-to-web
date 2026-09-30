const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext !== ".html" && ext !== ".htm") {
      return cb(new Error("File harus berformat HTML."));
    }

    cb(null, true);
  }
});

app.use(express.json({
  limit: "6mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "6mb"
}));

app.use(express.static(
  path.join(__dirname, "public")
));

function cleanName(name) {
  return String(name || "tama-site")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 35) || "tama-site";
}

function randomId() {
  return crypto
    .randomBytes(5)
    .toString("hex");
}

async function createDeployment(
  siteName,
  html
) {
  const projectName =
    `${cleanName(siteName)}-${randomId()}`;

  const response = await fetch(
    "https://api.vercel.com/v13/deployments",
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${VERCEL_TOKEN}`,

        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        name: projectName,

        target: "production",

        files: [
          {
            file: "index.html",
            data: html,
            encoding: "utf-8"
          }
        ]
      })
    }
  );

  const data =
    await response.json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      data?.message ||
      "Vercel deployment gagal."
    );
  }

  return {
    project: projectName,

    id:
      data.id ||
      data.uid ||
      null,

    status:
      data.readyState ||
      data.status ||
      "QUEUED",

    url:
      data.url
        ? `https://${data.url}`
        : null
  };
}

app.get("/api/status", (req, res) => {
  res.json({
    ok: true,
    service: "TAMA PURPLE DEPLOYER",
    vercel:
      Boolean(VERCEL_TOKEN)
  });
});

app.post(
  "/api/deploy",
  upload.single("html"),
  async (req, res) => {

    try {
      if (!VERCEL_TOKEN) {
        return res.status(500).json({
          ok: false,
          error:
            "VERCEL_TOKEN belum dipasang di Environment Variables."
        });
      }

      if (!req.file) {
        return res.status(400).json({
          ok: false,
          error:
            "File HTML belum dipilih."
        });
      }

      const html =
        req.file.buffer.toString("utf8");

      if (!html.trim()) {
        return res.status(400).json({
          ok: false,
          error:
            "File HTML kosong."
        });
      }

      const result =
        await createDeployment(
          req.body.siteName ||
            "tama-site",

          html
        );

      res.json({
        ok: true,
        message:
          "Website berhasil dideploy.",

        ...result
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        ok: false,
        error:
          error.message ||
          "Deployment gagal."
      });
    }
  }
);

app.post(
  "/api/deploy-code",
  async (req, res) => {

    try {
      if (!VERCEL_TOKEN) {
        return res.status(500).json({
          ok: false,
          error:
            "VERCEL_TOKEN belum dipasang."
        });
      }

      const html =
        String(req.body.html || "");

      if (!html.trim()) {
        return res.status(400).json({
          ok: false,
          error:
            "Kode HTML kosong."
        });
      }

      if (
        Buffer.byteLength(
          html,
          "utf8"
        ) > 5 * 1024 * 1024
      ) {
        return res.status(413).json({
          ok: false,
          error:
            "HTML maksimal 5 MB."
        });
      }

      const result =
        await createDeployment(
          req.body.siteName ||
            "tama-site",

          html
        );

      res.json({
        ok: true,
        message:
          "Website berhasil dideploy.",

        ...result
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        ok: false,
        error:
          error.message ||
          "Deployment gagal."
      });
    }
  }
);

app.use((error, req, res, next) => {

  if (error instanceof multer.MulterError) {

    if (
      error.code ===
      "LIMIT_FILE_SIZE"
    ) {
      return res.status(413).json({
        ok: false,
        error:
          "Ukuran HTML maksimal 5 MB."
      });
    }

    return res.status(400).json({
      ok: false,
      error: error.message
    });
  }

  if (error) {
    return res.status(400).json({
      ok: false,
      error: error.message
    });
  }

  next();
});

app.listen(PORT, () => {

  console.log(
    "TAMA PURPLE DEPLOYER ONLINE"
  );

  console.log(
    `PORT: ${PORT}`
  );

  console.log(
    `VERCEL: ${
      VERCEL_TOKEN
        ? "CONNECTED"
        : "NOT CONFIGURED"
    }`
  );
});
