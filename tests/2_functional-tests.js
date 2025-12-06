const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function () {
  this.timeout(5000);

  const board = 'test';
  const threadText = 'Functional Test Thread ' + new Date().getTime();
  const threadPassword = 'threadpass';
  const replyText = 'Functional Test Reply ' + new Date().getTime();
  const replyPassword = 'replypass';

  let testThreadId;
  let testReplyId;

  // 1) Crear nuevo hilo
  test('Creating a new thread: POST request to /api/threads/{board}', function (done) {
    chai
      .request(server)
      .post('/api/threads/' + board)
      .send({
        text: threadText,
        delete_password: threadPassword,
      })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        done();
      });
  });

  // 2) Ver 10 hilos más recientes (máx 3 replies)
  test('Viewing the 10 most recent threads with 3 replies each: GET request to /api/threads/{board}', function (done) {
    chai
      .request(server)
      .get('/api/threads/' + board)
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.isArray(res.body);
        assert.isAtMost(res.body.length, 10);

        const thread = res.body.find((t) => t.text === threadText);
        assert.exists(thread, 'Created thread should be in list');

        testThreadId = thread._id;

        assert.property(thread, 'replies');
        assert.isAtMost(thread.replies.length, 3);

        done();
      });
  });

  // 3) Reportar hilo
  test('Reporting a thread: PUT request to /api/threads/{board}', function (done) {
    chai
      .request(server)
      .put('/api/threads/' + board)
      .send({ thread_id: testThreadId })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'reported');
        done();
      });
  });

  // 4) Crear reply
  test('Creating a new reply: POST request to /api/replies/{board}', function (done) {
    chai
      .request(server)
      .post('/api/replies/' + board)
      .send({
        thread_id: testThreadId,
        text: replyText,
        delete_password: replyPassword,
      })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        done();
      });
  });

  // 5) Ver hilo con todas las replies
  test('Viewing a single thread with all replies: GET request to /api/replies/{board}', function (done) {
    chai
      .request(server)
      .get('/api/replies/' + board)
      .query({ thread_id: testThreadId })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.isObject(res.body);
        assert.equal(res.body._id, testThreadId);
        assert.isArray(res.body.replies);

        const reply = res.body.replies.find((r) => r.text === replyText);
        assert.exists(reply, 'Reply should be in replies array');
        testReplyId = reply._id;

        done();
      });
  });

  // 6) Reportar reply
  test('Reporting a reply: PUT request to /api/replies/{board}', function (done) {
    chai
      .request(server)
      .put('/api/replies/' + board)
      .send({
        thread_id: testThreadId,
        reply_id: testReplyId,
      })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'reported');
        done();
      });
  });

  // 7) Borrar reply con password incorrecto
  test('Deleting a reply with the incorrect password: DELETE request to /api/replies/{board} with an invalid delete_password', function (done) {
    chai
      .request(server)
      .delete('/api/replies/' + board)
      .send({
        thread_id: testThreadId,
        reply_id: testReplyId,
        delete_password: 'wrong-password',
      })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'incorrect password');
        done();
      });
  });

  // 8) Borrar reply con password correcta
  test('Deleting a reply with the correct password: DELETE request to /api/replies/{board} with a valid delete_password', function (done) {
    chai
      .request(server)
      .delete('/api/replies/' + board)
      .send({
        thread_id: testThreadId,
        reply_id: testReplyId,
        delete_password: replyPassword,
      })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'success');
        done();
      });
  });

  // 9) Borrar hilo con password incorrecta
  test('Deleting a thread with the incorrect password: DELETE request to /api/threads/{board} with an invalid delete_password', function (done) {
    chai
      .request(server)
      .delete('/api/threads/' + board)
      .send({
        thread_id: testThreadId,
        delete_password: 'wrong-password',
      })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'incorrect password');
        done();
      });
  });

  // 🔟 Borrar hilo con password correcta
  test('Deleting a thread with the correct password: DELETE request to /api/threads/{board} with a valid delete_password', function (done) {
    chai
      .request(server)
      .delete('/api/threads/' + board)
      .send({
        thread_id: testThreadId,
        delete_password: threadPassword,
      })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'success');
        done();
      });
  });
});
