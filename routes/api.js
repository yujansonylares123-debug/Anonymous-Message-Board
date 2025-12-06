'use strict';

const Thread = require('../models/thread');

module.exports = function (app) {
  // =========================
  // /api/threads/:board
  // =========================
  app
    .route('/api/threads/:board')

    // GET: 10 hilos más recientes, con máx 3 replies cada uno (sin reported ni delete_password)
    .get(async function (req, res) {
      const board = req.params.board;
      try {
        const threads = await Thread.find({ board })
          .sort({ bumped_on: -1 })
          .limit(10)
          .lean();

        const response = threads.map((t) => {
          const repliesSorted = (t.replies || [])
            .sort(
              (a, b) =>
                new Date(b.created_on).getTime() -
                new Date(a.created_on).getTime()
            )
            .slice(0, 3)
            .map((r) => ({
              _id: r._id,
              text: r.text,
              created_on: r.created_on,
            }));

          return {
            _id: t._id,
            text: t.text,
            created_on: t.created_on,
            bumped_on: t.bumped_on,
            replies: repliesSorted,
            replycount: (t.replies || []).length,
          };
        });

        res.json(response);
      } catch (err) {
        console.error(err);
        res.status(500).send('server error');
      }
    })

    // POST: crear hilo nuevo en el board
    .post(async function (req, res) {
      const board = req.params.board;
      const { text, delete_password } = req.body;

      if (!text || !delete_password) {
        return res.status(400).send('missing fields');
      }

      try {
        const now = new Date();
        await Thread.create({
          board,
          text,
          delete_password,
          created_on: now,
          bumped_on: now,
          reported: false,
          replies: [],
        });

        // FCC espera redirect al board
        return res.redirect('/b/' + board + '/');
      } catch (err) {
        console.error(err);
        return res.status(500).send('server error');
      }
    })

    // DELETE: borrar hilo con id + delete_password
    .delete(async function (req, res) {
      const { thread_id, delete_password } = req.body;
      if (!thread_id || !delete_password) {
        return res.status(400).send('missing fields');
      }

      try {
        const thread = await Thread.findById(thread_id);
        if (!thread || thread.delete_password !== delete_password) {
          return res.send('incorrect password');
        }

        await Thread.deleteOne({ _id: thread._id });
        return res.send('success');
      } catch (err) {
        console.error(err);
        return res.status(500).send('server error');
      }
    })

    // PUT: reportar hilo
    .put(async function (req, res) {
      const { thread_id } = req.body;
      if (!thread_id) {
        return res.status(400).send('missing thread_id');
      }

      try {
        const thread = await Thread.findByIdAndUpdate(
          thread_id,
          { reported: true },
          { new: true }
        );
        if (!thread) {
          return res.send('not found');
        }
        // FCC suele esperar 'reported'
        return res.send('reported');
      } catch (err) {
        console.error(err);
        return res.status(500).send('server error');
      }
    });

  // =========================
  // /api/replies/:board
  // =========================
  app
    .route('/api/replies/:board')

    // GET: un hilo con TODAS sus replies (sin reported ni delete_password)
    .get(async function (req, res) {
      const threadId = req.query.thread_id || req.query.threadId;
      if (!threadId) {
        return res.status(400).send('missing thread_id');
      }

      try {
        const t = await Thread.findById(threadId).lean();
        if (!t) {
          return res.send('thread not found');
        }

        const replies = (t.replies || []).map((r) => ({
          _id: r._id,
          text: r.text,
          created_on: r.created_on,
        }));

        const response = {
          _id: t._id,
          text: t.text,
          created_on: t.created_on,
          bumped_on: t.bumped_on,
          replies,
        };

        return res.json(response);
      } catch (err) {
        console.error(err);
        return res.status(500).send('server error');
      }
    })

    // POST: crear reply en un hilo concreto
    .post(async function (req, res) {
      const board = req.params.board;
      const { text, delete_password, thread_id } = req.body;

      if (!thread_id || !text || !delete_password) {
        return res.status(400).send('missing fields');
      }

      try {
        const thread = await Thread.findById(thread_id);
        if (!thread) {
          return res.send('thread not found');
        }

        const now = new Date();

        thread.replies.push({
          text,
          delete_password,
          created_on: now,
          reported: false,
        });

        thread.bumped_on = now;
        await thread.save();

        // redirect al hilo concreto
        return res.redirect('/b/' + board + '/' + thread._id);
      } catch (err) {
        console.error(err);
        return res.status(500).send('server error');
      }
    })

    // DELETE: borrar reply (realmente cambiar el texto a "[deleted]")
    .delete(async function (req, res) {
      const { thread_id, reply_id, delete_password } = req.body;
      if (!thread_id || !reply_id || !delete_password) {
        return res.status(400).send('missing fields');
      }

      try {
        const thread = await Thread.findById(thread_id);
        if (!thread) {
          return res.send('thread not found');
        }

        const reply = thread.replies.id(reply_id);
        if (!reply) {
          return res.send('reply not found');
        }

        if (reply.delete_password !== delete_password) {
          return res.send('incorrect password');
        }

        reply.text = '[deleted]';
        await thread.save();

        return res.send('success');
      } catch (err) {
        console.error(err);
        return res.status(500).send('server error');
      }
    })

    // PUT: reportar reply
    .put(async function (req, res) {
      const { thread_id, reply_id } = req.body;
      if (!thread_id || !reply_id) {
        return res.status(400).send('missing fields');
      }

      try {
        const thread = await Thread.findById(thread_id);
        if (!thread) {
          return res.send('thread not found');
        }

        const reply = thread.replies.id(reply_id);
        if (!reply) {
          return res.send('reply not found');
        }

        reply.reported = true;
        await thread.save();

        return res.send('reported');
      } catch (err) {
        console.error(err);
        return res.status(500).send('server error');
      }
    });
};
