const { sendError } = require('../response');

function notFound(req, res) {
	return sendError(res, `Route not found: ${req.originalUrl}`, 404);
}

function errorHandler(err, req, res, next) {
	if (res.headersSent) {
		return next(err);
	}

	const statusCode = err.statusCode || err.status || 500;
	const message = err.message || 'Internal server error';

	return sendError(res, message, statusCode, err.errors || null);
}

module.exports = {
	notFound,
	errorHandler,
};
