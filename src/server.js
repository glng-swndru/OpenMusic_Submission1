// Mengimpor dotenv dan menjalankan konfigurasinya
require("dotenv").config();

const Hapi = require("@hapi/hapi");
const albums = require("./api/albums");
const songs = require("./api/songs");
const AlbumsService = require("./services/postgres/AlbumsService");
const albumsValidator = require("./validator/albums");
const SongsService = require("./services/postgres/SongsService");
const songsValidator = require("./validator/songs");
const ClientError = require("./exceptions/ClientError");

const init = async () => {
  try {
    // Membuat instance dari AlbumsService dan SongsService
    const albumsService = new AlbumsService();
    const songsService = new SongsService();

    // Membuat instance dari server Hapi
    const server = Hapi.server({
      port: process.env.PORT,
      host: process.env.HOST,
      routes: {
        cors: {
          origin: ["*"],
        },
      },
    });

    // Mendaftarkan plugin albums dan songs ke server
    await server.register([
      {
        plugin: albums,
        options: {
          AlbumsService: albumsService,
          SongsService: songsService,
          AlbumsValidator: albumsValidator,
        },
      },
      {
        plugin: songs,
        options: {
          SongsService: songsService,
          SongsValidator: songsValidator,
        },
      },
    ]);

    // Handle client errors secara global menggunakan server extension
    server.ext("onPreResponse", (request, h) => {
      const { response } = request;

      console.log("Response before handling ClientError:", response);

      // Refaktor untuk selalu mengembalikan tipe yang sama
      if (response instanceof Error) {
        if (response instanceof ClientError) {
          console.log("Handling ClientError");
          const newResponse = h.response({
            status: "fail",
            message: response.message,
          });
          newResponse.code(response.statusCode);
          return newResponse.takeover();
        }

        if (!response.isServer) {
          // Melanjutkan ke extension point berikutnya jika bukan kesalahan server
          return h.continue;
        }

        console.error("Handling Server Error:", response.message);
        const newResponse = h.response({
          status: "error",
          message: "Terjadi kegagalan pada server kami",
        });
        newResponse.code(500);

        return newResponse.takeover();
      }

      // Jika bukan instance dari Error, melanjutkan dengan respons yang ada
      if (response.statusCode === 200 && response.source.status === "fail") {
        // Jika album tidak ditemukan, atur status kode menjadi 404
        response.code(404);
      }

      return h.continue;
    });

    // Memulai server
    await server.start();
    console.log(`Server berjalan pada ${server.info.uri}`);
  } catch (error) {
    console.error("Error during server initialization:", error);
    process.exit(1); // Keluar dari proses jika terjadi kesalahan
  }
};

// Memanggil fungsi init untuk memulai server
init();
