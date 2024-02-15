const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const { mapAlbumsToModel } = require('../../utils/albums');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');
const ClientError = require('../../exceptions/ClientError');

class AlbumsService {
    constructor(cacheService) {
        this._pool = new Pool();
        this._cacheService = cacheService;
    }

    async addAlbum({ name, year }) {
        const id = `album-${nanoid(16)}`;
        const createdAt = new Date().toISOString();

        const query = {
            text: 'INSERT INTO albums (id, name, year, created_at, updated_at) VALUES ($1, $2, $3, $4, $4) RETURNING id',
            values: [id, name, year, createdAt],
        };

        try {
            const result = await this._pool.query(query);

            if (!result.rows[0]?.id) {
                throw new InvariantError('Album gagal ditambahkan');
            }

            return result.rows[0].id;
        } catch (error) {
            throw new InvariantError(`Error adding album: ${error.message}`);
        }
    }

    async getAlbums() {
        const query = 'SELECT * FROM albums';

        try {
            const result = await this._pool.query(query);
            return result.rows.map(mapAlbumsToModel);
        } catch (error) {
            throw new Error(`Error fetching albums: ${error.message}`);
        }
    }

    async getAlbumById(id) {
        console.log(`Fetching album by ID: ${id}`);
        const queryAlbum = {
            text: 'SELECT id, name, year FROM albums WHERE id = $1',
            values: [id],
        };

        try {
            const resultAlbum = await this._pool.query(queryAlbum);

            if (!resultAlbum.rows.length) {
                console.log(`Album not found for ID: ${id}`);
                return null;
            }

            console.log(`Album found for ID: ${id}`);
            return mapAlbumsToModel(resultAlbum.rows[0]);
        } catch (error) {
            console.error(`Error fetching album by ID: ${error.message}`);
            throw new Error(`Error fetching album by ID: ${error.message}`);
        }
    }

    async editAlbumById(id, { name, year }) {
        const updatedAt = new Date().toISOString();

        const query = {
            text: 'UPDATE albums SET name = $1, year = $2, updated_at = $3 WHERE id = $4 RETURNING id',
            values: [name, year, updatedAt, id],
        };

        try {
            const result = await this._pool.query(query);

            if (!result.rowCount) {
                throw new NotFoundError('Gagal memperbarui album. Id tidak ditemukan');
            }
        } catch (error) {
            throw new Error(`Error updating album by ID: ${error.message}`);
        }
    }

    async deleteAlbumById(id) {
        const query = {
            text: 'DELETE FROM albums WHERE id = $1 RETURNING id',
            values: [id],
        };

        try {
            const result = await this._pool.query(query);

            if (!result.rowCount) {
                throw new NotFoundError('Album gagal dihapus. Id tidak ditemukan');
            }
        } catch (error) {
            throw new Error(`Error deleting album by ID: ${error.message}`);
        }
    }

    async checkAlbum(id) {
        const query = {
            text: 'SELECT * FROM albums WHERE id = $1',
            values: [id],
        };

        try {
            const result = await this._pool.query(query);

            if (!result.rows.length) {
                throw new NotFoundError('Album tidak ditemukan');
            }
        } catch (error) {
            throw new NotFoundError(`Error checking album by ID: ${error.message}`);
        }
    }

    async addLikeAndDislikeAlbum(albumId, userId) {
        const like = 'like';

        const queryCheckLike = {
            text: 'SELECT id FROM user_album_likes WHERE user_id = $1 AND album_id = $2',
            values: [userId, albumId],
        };

        try {
            const resultCheckLike = await this._pool.query(queryCheckLike);

            if (resultCheckLike.rows.length) {
                throw new ClientError('Tidak dapat menambahkan like');
            } else {
                const id = `album-like-${nanoid(16)}`;

                const queryAddLike = {
                    text: 'INSERT INTO user_album_likes VALUES($1, $2, $3) RETURNING id',
                    values: [id, userId, albumId],
                };

                await this._pool.query(queryAddLike);
                await this._cacheService.delete(`user_album_likes:${albumId}`);
            }
        } catch (error) {
            throw new Error(`Error adding like to album: ${error.message}`);
        }

        return like;
    }

    async getLikesAlbumById(id) {
        try {
            const source = 'cache';
            const likes = await this._cacheService.get(`user_album_likes:${id}`);
            return { likes: +likes, source };
        } catch (error) {
            try {
                await this.checkAlbum(id);

                const query = {
                    text: 'SELECT * FROM user_album_likes WHERE album_id = $1',
                    values: [id],
                };

                const result = await this._pool.query(query);

                const likes = result.rows.length;

                await this._cacheService.set(`user_album_likes:${id}`, likes);

                const source = 'server';

                return { likes, source };
            // eslint-disable-next-line no-shadow
            } catch (error) {
                throw new Error(
                    `Error getting likes for album by ID: ${error.message}`,
                );
            }
        }
    }

    async unLikeAlbumById(albumId, userId) {
        const query = {
            text: 'SELECT id FROM user_album_likes WHERE user_id = $1 AND album_id = $2',
            values: [userId, albumId],
        };

        try {
            const result = await this._pool.query(query);

            const queryDeleteLike = {
                text: 'DELETE FROM user_album_likes WHERE id = $1 RETURNING id',
                values: [result.rows[0]?.id],
            };

            await this._pool.query(queryDeleteLike);
            await this._cacheService.delete(`user_album_likes:${albumId}`);
        } catch (error) {
            throw new Error(`Error unliking album by ID: ${error.message}`);
        }
    }
}

module.exports = AlbumsService;
