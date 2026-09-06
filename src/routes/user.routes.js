const express = require('express');

const router = express.Router();
const users = new Map();
let nextUserId = 1;

router.post('/', (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Name and email are required',
    });
  }

  const user = {
    id: String(nextUserId),
    name,
    email,
    createdAt: new Date().toISOString(),
  };

  nextUserId += 1;
  users.set(user.id, user);

  return res.status(201).json(user);
});

router.get('/:id', (req, res) => {
  const user = users.get(req.params.id);

  if (!user) {
    return res.status(404).json({
      error: 'NotFoundError',
      message: `User with id ${req.params.id} was not found`,
    });
  }

  return res.json(user);
});

module.exports = router;
