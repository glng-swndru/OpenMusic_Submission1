// Mengimpor dotenv dan menjalankan konfigurasinya
require('dotenv').config();

const Hapi = require('@hapi/hapi');
const Jwt = require('@hapi/jwt');
const Inert = require('@hapi/inert');
const path = require('path');
const ClientError = require('./exceptions/ClientError');

// albums
const albums = require('./api/albums');
const albumsValidator = require('./validator/albums');
const AlbumsService = require('./services/postgres/AlbumsService');

// songs
const songs = require('./api/songs');
const songsValidator = require('./validator/songs');
const SongsService = require('./services/postgres/SongsService');

// Authentications
const authentications = require('./api/authentications');
const authenticationsValidator = require('./validator/authentications');
const AuthenticationsService = require('./services/postgres/AuthenticationsService');
const tokenManager = require('./tokenize/tokenManager');

// Users
const users = require('./api/users');
const usersValidator = require('./validator/users');
const UsersService = require('./services/postgres/UsersService');

// Playlists
const playlists = require('./api/playlists');
const playlistsValidator = require('./validator/playlists');
const PlaylistsService = require('./services/postgres/PlaylistService');
const PlaylistsSongsService = require('./services/postgres/PlaylistSongsService');
const PlaylistsSongsActivitiesService = require('./services/postgres/PlaylistsSongsActivitiesService');

// Collaborations
const collaborations = require('./api/collaborations');
const CollaborationsValidator = require('./validator/collaborations');
const CollaborationsService = require('./services/postgres/CollaborationsService');

// Uploads
const StorageService = require('./services/storages/StorageService');
const UploadsValidator = require('./validator/uploads');

const init = async () => {
    try {
        // Membuat instance dari AlbumsService dan SongsService
        const albumsService = new AlbumsService();
        const songsService = new SongsService();
        const authenticationsService = new AuthenticationsService();
        const usersService = new UsersService();
        const collaborationsService = new CollaborationsService();
        const playlistsService = new PlaylistsService(collaborationsService);
        const playlistsSongsService = new PlaylistsSongsService();
        const playlistsSongsActivitiesService = new PlaylistsSongsActivitiesService();
        const storageService = new StorageService(
            path.resolve(__dirname, 'api/albums/file/covers'),
        );

        // Membuat instance dari server Hapi
        const server = Hapi.server({
            port: process.env.PORT,
            host: process.env.HOST,
            routes: {
                cors: {
                    origin: ['*'],
                },
            },
        });

        // registrasi plugin eksternal
        await server.register([
            {
                plugin: Jwt,
            },
            {
                plugin: Inert,
            },
        ]);

        // mendefinisikan strategy autentikasi jwt
        server.auth.strategy('openmusic_jwt', 'jwt', {
            keys: process.env.ACCESS_TOKEN_KEY,
            verify: {
                aud: false,
                iss: false,
                sub: false,
                maxAgeSec: process.env.ACCESS_TOKEN_AGE,
            },
            validate: (artifacts) => ({
                isValid: true,
                credentials: {
                    id: artifacts.decoded.payload.id,
                },
            }),
        });

        // Mendaftarkan plugin albums dan songs ke server
        await server.register([
            {
                plugin: albums,
                options: {
                    AlbumsService: albumsService,
                    SongsService: songsService,
                    AlbumsValidator: albumsValidator,
                    StorageService: storageService,
                    UploadsValidator,
                },
            },
            {
                plugin: songs,
                options: {
                    SongsService: songsService,
                    SongsValidator: songsValidator,
                },
            },
            {
                plugin: authentications,
                options: {
                    AuthenticationsService: authenticationsService,
                    UsersService: usersService,
                    TokenManager: tokenManager,
                    AuthenticationsValidator: authenticationsValidator,
                },
            },
            {
                plugin: users,
                options: {
                    UsersService: usersService,
                    UsersValidator: usersValidator,
                },
            },
            {
                plugin: playlists,
                options: {
                    PlaylistsService: playlistsService,
                    PlaylistsSongsService: playlistsSongsService,
                    PlaylistsSongsActivitiesService: playlistsSongsActivitiesService,
                    PlaylistsValidator: playlistsValidator,
                },
            },
            {
                plugin: collaborations,
                options: {
                    CollaborationsService: collaborationsService,
                    PlaylistsService: playlistsService,
                    CollaborationsValidator,
                },
            },
        ]);

        // Handle client errors secara global menggunakan server extension
        server.ext('onPreResponse', (request, h) => {
            const { response } = request;

            console.log('Response before handling ClientError:', response);

            // Refaktor untuk selalu mengembalikan tipe yang sama
            if (response instanceof Error) {
                if (response instanceof ClientError) {
                    console.log('Handling ClientError');
                    const newResponse = h.response({
                        status: 'fail',
                        message: response.message,
                    });
                    newResponse.code(response.statusCode);
                    return newResponse.takeover();
                }

                if (!response.isServer) {
                    // Melanjutkan ke extension point berikutnya jika bukan kesalahan server
                    return h.continue;
                }

                console.error('Handling Server Error:', response.message);
                const newResponse = h.response({
                    status: 'error',
                    message: 'Terjadi kegagalan pada server kami',
                });
                newResponse.code(500);

                return newResponse.takeover();
            }

            // Jika bukan instance dari Error, melanjutkan dengan respons yang ada
            if (response.statusCode === 200 && response.source.status === 'fail') {
                // Jika album tidak ditemukan, atur status kode menjadi 404
                response.code(404);
            }

            return h.continue;
        });

        // Memulai server
        await server.start();
        console.log(`Server berjalan pada ${server.info.uri}`);
    } catch (error) {
        console.error('Error during server initialization:', error);
        process.exit(1); // Keluar dari proses jika terjadi kesalahan
    }
};

// Memanggil fungsi init untuk memulai server
init();
