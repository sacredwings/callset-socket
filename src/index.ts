// @ts-nocheck
import {mongo} from "../src/lib/connect"
import { CUser } from "../src/classes/user"
import { CAuth } from "../src/classes/auth"
import http from "http"
import { Server } from "socket.io" // Используем деструктуризацию
import Joi from "joi"
import config from "../config.json"

// --- КОНФИГУРАЦИЯ ---
const PORT = process.env.PORT || 3001
// --------------------

const httpServer = http.createServer()

// Настройки CORS: Разрешаем подключения с вашего Next.js приложения (localhost:3000)
// В продакшене нужно будет указать конкретный домен вашего Next.js приложения.
const io = new Server(httpServer, {
    cors: {
        origin: config.server.cors, // Ваш Next.js dev сервер
        methods: ["GET", "POST"]
    }
})
mongo()

// Простейший менеджер пользователей. В реальном приложении нужна более надежная структура.
// { userId: socketId }
//let users = {};
const userSockets = new Map()

// Откуда мы можем получить ID другого пользователя, кому отправить offer/answer/candidate
// В этом простом примере, мы будем просто искать любого другого подключенного пользователя.
// Более сложная логика: комнаты, списки пользователей и т.д.

io.use(async (socket, next) => {
    const auth = {
        tid: await socket.handshake.query.tid,
        tkey: await socket.handshake.query.tkey
    }
    const rsRequest = await socket.handshake.query
    //const tid = await socket.handshake.query.tid;
    //const tkey = await socket.handshake.query.tkey;
    let resAuth = null
    //console.log(auth)
    try {
        //схема
        const schema = Joi.object({
            tid: Joi.string().min(24).max(24).required(),
            tkey: Joi.string().min(32).max(32).required(),
        })
        resAuth = await schema.validateAsync(auth)

    } catch (err) {
        return next(new Error('Authentication error: No token'))
    }
    //console.log(resAuth)
    /*
    console.log(socket.handshake.query.tid)
    console.log(socket.handshake.query.tkey)
    console.log(tid)
    console.log(tkey)
    console.log(typeof tid )
    if (tid === null) console.log(true); else console.log(false)
    if ((!tid) || (!tkey)) console.log(true); else console.log(false)
    if ((!tid) || (!tkey)) return next(new Error('Authentication error: No token'))
*/
    //console.log((!tid && !tkey) ? true : false)
    //console.log('!!!!!!!!!!!')


    let userId = await CAuth.TokenGetByIdKey(resAuth)
    if (!userId) return next(new Error('Authentication error: No auth'))
    let resUserId = await CUser.GetById ( [userId] )
    if (!resUserId) return next(new Error('Authentication error: No user'))

    //console.log(resUserId)

    socket.userId = userId.toString()

    return next() // Продолжить соединение

    /*
    if (tid && tkey) {
        // Здесь вы должны проверить токен (например, сравнить с ожидаемым,
        // проверить его валидность, найти пользователя по токену и т.д.)
        // В этом примере мы просто проверяем, что токен существует.
        // В реальном приложении, конечно, нужна более сложная логика.
        console.log('Получен tid:', tid);
        console.log('Получен tkey:', tkey);

        return next(); // Продолжить соединение

        //return next(new Error('Authentication error: Invalid token'));


        // Пример простой проверки (замените на вашу реальную проверку)
        if (token === 'ваш_токен_здесь') {
            // Если токен валиден, сохраните данные пользователя в объекте socket
            // socket.user = { id: 'user123', username: 'Alice' };
            console.log('Token is valid. Authenticating user.');
            return next(); // Продолжить соединение
        } else {
            // Если токен невалиден, отклонить соединение
            console.log('Invalid token. Rejecting connection.');
            return next(new Error('Authentication error: Invalid token'));
        }
    } else {
        // Если токен не был передан
        console.log('No token provided. Rejecting connection.');
        return next(new Error('Authentication error: No token provided'));
    }*/
})

io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected (socket ID: ${socket.id})`)

    //console.log(userSockets)

    // Добавляем сокет в Map подключений пользователя
    if (!userSockets.has(socket.userId)) {
        userSockets.set(socket.userId, new Set()) // Используем Set, чтобы избежать дубликатов сокетов
    }
    userSockets.get(socket.userId).add(socket)

    //
    socket.on('callConnecting', (receiverId) => {
        console.log(`User ${socket.userId} callConnecting (socket ID: ${socket.id}) to receiverId ${receiverId}`)
        if (receiverId) {
            //все сокеты пользователя
            const sockets = userSockets.get(receiverId)

            if (sockets) {
                //каждому сокету пользователя
                for (const sock of sockets) {
                    sock.emit('callConnecting', socket.userId, socket.id)
                }
            }
        } else {
            console.log('No receiver.')
            // Возможно, нужно отправить обратно отправителю сообщение "нет доступных пользователей"
        }
    })

    //
    socket.on('callConnected', (receiverId) => {
        console.log(`User ${socket.userId} callConnected (socket ID: ${socket.id}) to receiverId ${receiverId}`)
        if (receiverId) {
            //все сокеты пользователя
            const sockets = userSockets.get(receiverId)

            if (sockets) {
                //каждому сокету пользователя
                for (const sock of sockets) {
                    sock.emit('callConnected', socket.userId, socket.id)
                }
            }
        } else {
            console.log('No receiver.')
            // Возможно, нужно отправить обратно отправителю сообщение "нет доступных пользователей"
        }
    })

    //
    socket.on('callDisconnected', (receiverId) => {

        if (receiverId) {
            // ... при отправке сообщения всем сокетам пользователя ...
            const sockets = userSockets.get(receiverId)

            if (sockets) {
                for (const sock of sockets) {
                    // Отправляем offer и ID отправителя, чтобы получатель мог ответить отправителю
                    //io.to(receiverId).emit('offer', offer, socket.id)
                    sock.emit('callDisconnected', socket.userId)
                }
            }
        } else {
            console.log('No receiver.')
            // Возможно, нужно отправить обратно отправителю сообщение "нет доступных пользователей"
        }
    })

    // --- Обработка предложения WebRTC ---
    socket.on('offer', (offer, receiverId) => {

        if (receiverId) {
            // ... при отправке сообщения всем сокетам пользователя ...
            const sockets = userSockets.get(receiverId)

            if (sockets) {
                for (const sock of sockets) {
                    // Отправляем offer и ID отправителя, чтобы получатель мог ответить отправителю
                    //io.to(receiverId).emit('offer', offer, socket.id)
                    sock.emit('offer', offer, socket.userId, socket.id)
                }
            }
        } else {
            console.log('No receiver found for offer.')
            // Возможно, нужно отправить обратно отправителю сообщение "нет доступных пользователей"
        }
    })

    // --- Обработка ответа WebRTC ---
    socket.on('answer', (answer, receiverId) => {
        // Мы хотим передать ответ этому отправителю.
        if (receiverId) {
            // ... при отправке сообщения всем сокетам пользователя ...
            const sockets = userSockets.get(receiverId)
            if (sockets) {
                for (const sock of sockets) {
                    // Отправляем offer и ID отправителя, чтобы получатель мог ответить отправителю
                    //io.to(receiverId).emit('answer', answer, socket.id)
                    sock.emit('answer', answer, socket.userId, socket.id)
                }
            }
        } else {
            console.log(`Sender ${receiverId} not found for answer.`)
        }
    })

    // --- Обработка ответа WebRTC ---
    socket.on('candidate', (candidate, receiverId) => {
        // Мы хотим передать ответ этому отправителю.
        if (receiverId) {
            // ... при отправке сообщения всем сокетам пользователя ...
            const sockets = userSockets.get(receiverId)
            if (sockets) {
                for (const sock of sockets) {
                    // Отправляем offer и ID отправителя, чтобы получатель мог ответить отправителю
                    //io.to(receiverId).emit('answer', answer, socket.id)
                    sock.emit('candidate', candidate, socket.userId, socket.id)
                }
            }
        } else {
            console.log(`Sender ${receiverId} not found for candidate.`)
        }
    })



    /*
    // Рассылаем всем сокетам этого пользователя
    const sockets = userSockets.get(socket.userId);
    if (sockets) {
        sockets.forEach(s => {
            if (s.id !== socket.id) {  // Не отправляем отправителю, если надо
                s.emit('chat message', {
                    userId: socket.userId,
                    message: message,
                });
            }

        });
    }*/
/*
// ... при отправке сообщения всем сокетам пользователя ...
const sockets = userSockets.get(userId);
if (sockets) {
    for (const sock of sockets) {
        sock.emit('message', { text: 'Сообщение', sender: userInfos.get(userId).name });
    }
}

// ... при отключении ...
const socketsForUser = userSockets.get(socket.userId);
if (socketsForUser) {
    socketsForUser.delete(socket); // Удаляем конкретный сокет
    if (socketsForUser.size === 0) {
        userSockets.delete(socket.userId); // Удаляем запись о пользователе, если нет активных сокетов
        userInfos.delete(socket.userId); // Удаляем информацию о пользователе
    }
}


    // --- Обработка предложения WebRTC ---
    socket.on('offer', (offer, receiverId) => {
        // senderId - это ID того, кто отправил offer (текущий `socket.id` в его браузере)
        // Мы хотим передать этот offer другому пользователю.
        // В нашем простом случае, мы найдем любого другого пользователя.
        console.log(`${socket.id} отправляет offer пользователю ${receiverId}`);
        //const receiverId = Object.keys(users).find(userId => userId !== senderId);

        if (receiverId) {
            // Отправляем offer и ID отправителя, чтобы получатель мог ответить отправителю
            io.to(receiverId).emit('offer', offer, socket.id);
            console.log(`Forwarded offer to ${receiverId}`);
        } else {
            console.log('No receiver found for offer.');
            // Возможно, нужно отправить обратно отправителю сообщение "нет доступных пользователей"
        }
    });

    // --- Обработка ответа WebRTC ---
    socket.on('answer', (answer, receiverId) => {
        // senderId - это ID того, кто изначально отправил offer.
        // Мы хотим передать ответ этому отправителю.
        console.log(`Ответ на answer ${receiverId}...`);
        if (receiverId) {
            io.to(receiverId).emit('answer', answer);
            console.log(`Forwarded answer to ${receiverId}`);
        } else {
            console.log(`Sender ${receiverId} not found for answer.`);
        }
    });
 */


    //---------------------------------------------------------------------------------------------
    /*
    // --- Обработка ICE кандидатов ---
    socket.on('candidate', (candidate, senderId) => {
        // senderId - это ID того, кому мы хотим отправить candidate.
        console.log(`Received candidate. Forwarding to sender ${senderId}...`);
        if (senderId && users[senderId]) {
            io.to(users[senderId]).emit('candidate', candidate, socket.id); // Отправляем candidate и ID текущего сокета
            console.log(`Forwarded candidate to ${users[senderId]}`);
        } else {
            console.log(`Sender ${senderId} not found for candidate.`);
        }
    });

    // --- Обработка сообщений чата ---
    socket.on('message', (data, receiverId)=> {
        // data = { text: '...', sender: 'socket.id' }
        console.log(`Сообщение отправлено: ${socket.id}, получатель: ${receiverId}, сообщение: ${data.text}`);

        // Находим получателя (в простом случае - любого другого пользователя)
        //const receiverId = Object.keys(users).find(userId => userId === data.senderId);

        if (receiverId) {
            // Отправляем сообщение получателю
            io.to(receiverId).emit('message', data, socket.id, receiverId);
            console.log(`Broadcasted chat message to ${receiverId}`);
        } else {
            console.log('No receiver found for chat message.');
            // Можно отправить сообщение обратно отправителю:
            // io.to(data.sender).emit('chat', { text: 'No one to send message to.', sender: 'server' });
        }
    });*/

    // --- Управление пользователями ---
    // Здесь мы используем socket.id как идентификатор пользователя.
    // Это упрощенная модель. Для реального приложения, где пользователи
    // должны быть уникальными, вам нужно будет передавать `userId` при подключении
    // и сохранять его.
    //users[socket.id] = socket.id; // Сохраняем просто socket.id



    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id)
        //delete users[socket.id]; // Удаляем пользователя при отключении

        const sockets = userSockets.get(socket.userId)
        if (sockets) {
            sockets.delete(socket)
        }

        console.log(userSockets)
    })
})

// --- Запуск сервера ---
httpServer.listen(PORT, () => {
    console.log(`Signaling server listening on port ${PORT}`)
})