const path = require("path");

const routes = (handler) => [
  {
    method: "POST",
    path: "/albums",
    handler: (request, h) => handler.postAlbumHandler(request, h),
  },
  {
    method: "GET",
    path: "/albums",
    handler: () => handler.getAlbumsHandler(),
  },
  {
    method: "GET",
    path: "/albums/{id}",
    handler: (request) => handler.getAlbumByIdHandler(request),
  },
  {
    method: "PUT",
    path: "/albums/{id}",
    handler: (request, h) => handler.putAlbumByIdHandler(request, h),
  },
  {
    method: "DELETE",
    path: "/albums/{id}",
    handler: (request, h) => handler.deleteAlbumByIdHandler(request, h),
  },
  {
    method: "POST",
    path: "/albums/{id}/covers",
    handler: handler.postUploadCoverHandler,
    options: {
      payload: {
        allow: "multipart/form-data",
        multipart: true,
        output: "stream",
        maxBytes: 512000,
      },
    },
  },
  {
    method: "GET",
    path: "/albums/covers/{param*}",
    handler: (request, h) => {
      return h.file(
        path.resolve(__dirname, "file/covers", request.params.param)
      );
    },
  },
  {
    method: "POST",
    path: "/albums/{id}/likes",
    handler: handler.postLikesAlbumHandler,
    // options: { // Hapus opsi otentikasi JWT
    //     auth: 'openmusic_jwt',
    // },
  },
  {
    method: "GET",
    path: "/albums/{id}/likes",
    handler: handler.getLikesAlbumByIdhandler,
  },
  {
    method: "DELETE",
    path: "/albums/{id}/likes",
    handler: handler.deleteLikesAlbumByIdhandler,
    // options: { // Hapus opsi otentikasi JWT
    //     auth: 'openmusic_jwt',
    // },
  },
];

module.exports = routes;
