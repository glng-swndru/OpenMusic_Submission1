/* eslint-disable linebreak-style */
const autoBind = require('auto-bind');

class AlbumsHandler {
    constructor(
        AlbumsService,
        SongsService,
        AlbumsValidator,
        StorageService,
        UploadsValidator,
    ) {
        this._albumsService = AlbumsService;
        this._songsService = SongsService;
        this._albumsValidator = AlbumsValidator;
        this._storageService = StorageService;
        this._uploadsValidator = UploadsValidator;

        this.postAlbumHandler = this.postAlbumHandler.bind(this);
        this.getAlbumsHandler = this.getAlbumsHandler.bind(this);
        this.getAlbumByIdHandler = this.getAlbumByIdHandler.bind(this);
        this.putAlbumByIdHandler = this.putAlbumByIdHandler.bind(this);
        this.deleteAlbumByIdHandler = this.deleteAlbumByIdHandler.bind(this);
        autoBind(this);
    }

    async postAlbumHandler(request, h) {
        this._albumsValidator.validateAlbumsPayload(request.payload);

        const albumId = await this._albumsService.addAlbum(request.payload);

        const response = h.response({
            status: 'success',
            message: 'Album berhasil ditambahkan',
            data: {
                albumId,
            },
        });

        response.code(201);
        return response;
    }

    async getAlbumsHandler() {
        const albums = await this._albumsService.getAlbums();

        return {
            status: 'success',
            data: {
                albums,
            },
        };
    }

    async getAlbumByIdHandler(request, h) {
        try {
            const { id } = request.params;

            const album = await this._albumsService.getAlbumById(id);

            if (!album) {
                console.error(`Album not found for ID: ${id}`);
                console.log('Preparing direct object for 404');

                const newResponse = h?.response({
                    status: 'fail',
                    message: 'Album tidak ditemukan',
                });

                // Gunakan optional chaining untuk memeriksa apakah newResponse ada
                if (newResponse) {
                    console.log('Preparing h.response for 404');
                    newResponse.code(404);
                    return newResponse;
                }
                console.log('Preparing direct object for 404');
                return {
                    status: 'fail',
                    message: 'Album tidak ditemukan',
                };
            }

            console.log(`Album found for ID: ${id}`);
            album.songs = await this._songsService.getSongByAlbumId(id);

            return {
                status: 'success',
                data: {
                    album,
                },
            };
        } catch (error) {
            console.error(`Error in getAlbumByIdHandler: ${error.message}`);

            const errorResponse = h?.response({
                status: 'error',
                message: 'Gagal mengambil detail album',
            });

            // Gunakan optional chaining untuk memeriksa apakah errorResponse ada
            if (errorResponse) {
                console.log('Preparing h.response for 500');
                return errorResponse.code(500);
            }
            console.log('Preparing direct object for 500');
            return {
                status: 'error',
                message: 'Gagal mengambil detail album',
            };
        }
    }

    async putAlbumByIdHandler(request, h) {
        this._albumsValidator.validateAlbumsPayload(request.payload);

        const { id } = request.params;
        const album = await this._albumsService.getAlbumById(id);

        if (!album) {
            return h
                .response({
                    status: 'fail',
                    message: 'Album tidak ditemukan',
                })
                .code(404);
        }

        await this._albumsService.editAlbumById(id, request.payload);

        return h.response({
            status: 'success',
            message: 'Album berhasil diperbarui',
        });
    }

    async deleteAlbumByIdHandler(request, h) {
        const { id } = request.params;
        const album = await this._albumsService.getAlbumById(id);

        if (!album) {
            console.log(`Album not found for ID: ${id}. Returning 404 response.`);
            return h
                .response({
                    status: 'fail',
                    message: 'Album tidak ditemukan',
                })
                .code(404);
        }

        try {
            console.log(`Deleting album for ID: ${id}`);
            await this._albumsService.deleteAlbumById(id);

            console.log(
                `Album deleted successfully for ID: ${id}. Returning 200 response.`,
            );
            return h.response({
                status: 'success',
                message: 'Album berhasil dihapus',
            });
        } catch (error) {
            console.error(`Error in deleteAlbumByIdHandler: ${error.message}`);

            return h
                .response({
                    status: 'error',
                    message: 'Gagal menghapus album',
                })
                .code(500);
        }
    }

    async postUploadCoverHandler(request, h) {
        const { id } = request.params;
        const { cover } = request.payload;

        await this._albumsService.checkAlbum(id);

        this._uploadsValidator.validateImageHeaders(cover.hapi.headers);

        const filename = await this._storageService.writeFile(cover, cover.hapi);
        const fileLocation = `http://${process.env.HOST}:${process.env.PORT}/albums/covers/${filename}`;

        await this._albumsService.editAlbumToAddCoverById(id, fileLocation);

        const response = h.response({
            status: 'success',
            message: 'Cover berhasil diupload',
        });

        response.code(201);
        return response;
    }

    async postLikesAlbumHandler(request, h) {
        const { id } = request.params;
        const { id: credentialId } = request.auth.credentials;

        await this._albumsService.checkAlbum(id);

        const like = await this._albumsService.addLikeAndDislikeAlbum(
            id,
            credentialId,
        );

        return h
            .response({
                status: 'success',
                message: `Berhasil ${like} Album`,
            })
            .code(201);
    }

    async getLikesAlbumByIdhandler(request, h) {
        const { id } = request.params;
        const { likes, source } = await this._albumsService.getLikesAlbumById(id);

        const response = h.response({
            status: 'success',
            data: {
                likes,
            },
        });

        response.header('X-Data-Source', source);
        return response;
    }

    async deleteLikesAlbumByIdhandler(request, h) {
        const { id } = request.params;
        const { id: credentialId } = request.auth.credentials;

        await this._albumsService.checkAlbum(id);

        await this._albumsService.unLikeAlbumById(id, credentialId);

        return h
            .response({
                status: 'success',
                message: 'Album batal disukai',
            })
            .code(200);
    }
}

module.exports = AlbumsHandler;
