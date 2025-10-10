// @ts-nocheck
import bcrypt from "bcryptjs"
import * as crypto from "crypto"
import { DB } from "./db"
import { CUser } from './user'
import axios from "axios"
import { Store } from "./store"

export class CAuth {

    //авторизация по полю и паролю
    //* password
    //* ip
    //* device
    static async LoginByField ({password, ip, device, ...value}) {
        try {
            //поиск пользователя
            let user = await CUser.GetByField(value)
            if (!user)
                throw ({code: 1001001, msg: 'Пользователь не найден'})

            //сравнение паролей
            let match = await bcrypt.compare(password, user.password)
            if (!match)
                throw ({code: 1001002, msg: 'Неверный пароль'})

            //новый токен
            let token = await this.TokenAdd({
                user_id: user._id,
                ip: ip,
                device: device
            })
            if (!token)
                throw ({code: 1001003, msg: 'Токен не создан'})

            return {tid: token._id, tkey: token.key, _id: user._id, login: user.login}

        } catch (err) {
            console.log(err)
            throw ({...{code: 1001000, msg: 'CAuth Login'}, ...err})
        }
    }

    //Добавление токена
    //* password
    //* ip
    //* device
    static async TokenAdd ({user_id, ip, device}) {
        try {
            const mongoClient = Store.GetMongoClient()
            let collection = mongoClient.collection('auth')

            //создаем hash
            let hash = new Date().toString() //ключ
            hash = crypto.createHash('md5').update(hash).digest("hex")

            //подготовка полей
            let arFields = {
                user_id: user_id,
                key: hash,

                ip: (ip) ? ip : null,
                device: (device) ? device : null,
            };
            await collection.insertOne(arFields)
            return arFields
        } catch (err) {
            console.log(err)
            throw ({code: 1004000, msg: 'CAuth TokenAdd'})
        }
    }

    //Проверяет авторизован ли посетитель
    //* tid
    //* tkey
    static async TokenGetByIdKey ({tid, tkey}) {
        try {
            const mongoClient = Store.GetMongoClient()
            tid = new DB().ObjectID(tid)

            //поиск ключа
            let collection = mongoClient.collection('auth');
            let token = await collection.findOne({_id: tid, key: tkey})

            if (!token) return false
            return token.user_id
        } catch (err) {
            console.log(err)
            throw ({code: 1004000, msg: 'CAuth IsAuthorized'})
        }
    }

}