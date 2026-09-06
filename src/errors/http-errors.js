function createHttpError(status, name, message) {
  const error = new Error(message);
  error.status = status;
  error.name = name;
  return error;
}

module.exports = { createHttpError };
