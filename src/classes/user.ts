// @ts-nocheck
import bcrypt from "bcryptjs"
import { DB } from "./db"
import { Store } from "./store"

export class CUser {

    //добавить пользователя
    static async Add(fields) {
        try {
            //ПОДГОТОВКА

            //обязательно нижний регистр
            if (fields.login)
                fields.login = fields.login.toLowerCase()

            //создание пароля
            if (fields.password) {
                //создаем hash пароль
                const saltRounds = 10
                let passwordSalt = await bcrypt.genSalt(saltRounds)
                fields.password = await bcrypt.hash(fields.password, passwordSalt)
            }

            //ПРОВЕРКА
            let arSearchUser = false

            if (fields.login)
                arSearchUser = await this.GetByField({login: fields.login})
            if (arSearchUser)
                throw ({code: 30020001, msg: 'Такой login уже зарегистрирован'})

            //ДЕЙСТВИЕ
            const mongoClient = Store.GetMongoClient()
            let collection = mongoClient.collection('user')

            let arFields = {...fields, create_date: new Date()}
            await collection.insertOne(arFields)

            return arFields
        } catch (err) {
            console.log(err)
            throw ({...{code: 7001000, msg: 'CUser Add'}, ...err})
        }
    }

    static async Edit(id, fields) {
        try {
            //ПОДГОТОВКА
            //ссылки
            id = new DB().ObjectID(id)

            //обязательно нижний регистр
            if (fields.login)
                fields.login = fields.login.toLowerCase()

            //создание пароля
            if (fields.password) {
                //создаем hash пароль
                const saltRounds = 10
                let passwordSalt = await bcrypt.genSalt(saltRounds)
                fields.password = await bcrypt.hash(fields.password, passwordSalt)
            }

            /*
            //ПРОВЕРКА
            if (fields.login)
                arSearchUser = await this.GetByField({login: fields.login, _id: { $ne: id }})
            if (arSearchUser)
                throw ({code: 30020001, msg: 'Такой login уже зарегистрирован'})
*/

            const mongoClient = Store.GetMongoClient()
            let collection = mongoClient.collection('user');

            let result = collection.updateOne({_id: id}, {$set: fields}, {upsert: true})
            return fields
        } catch (err) {
            console.log(err)
            throw ({...{code: 7002000, msg: 'CUser Edit'}, ...err})
        }
    }

    //поиск по id
    static async GetById ( ids ) {
        try {
            ids = new DB().ObjectID(ids)

            let arAggregate = []
            arAggregate.push({
                $match: {
                    _id: {$in: ids}
                }
            })
            arAggregate.push({
                $lookup: {
                    from: 'img',
                    localField: 'photo_id',
                    foreignField: '_id',
                    as: '_photo_id'
                }
            })
            arAggregate.push({
                $unwind: {
                    path: '$_photo_id',
                    preserveNullAndEmptyArrays: true
                }
            })

            const mongoClient = Store.GetMongoClient()
            let collection = mongoClient.collection(`user`)
            let result = await collection.aggregate(arAggregate).toArray()
            return result

        } catch (err) {
            console.log(err)
            throw ({...{code: 7001000, msg: 'CUser GetById'}, ...err})
        }
    }

    //Поиск по полю
    static async GetByField(fields) {
        try {
            //в нижний регистр
            if (fields._id) fields._id = new DB().ObjectID(fields._id)
            if (fields.login) fields.login = fields.login.toLowerCase()

            let arAggregate = []
            arAggregate.push({
                $match: fields
            })
            arAggregate.push({
                $lookup: {
                    from: 'img',
                    localField: 'photo_id',
                    foreignField: '_id',
                    as: '_photo_id'
                }
            })
            arAggregate.push({
                $unwind: {
                    path: '$_photo_id',
                    preserveNullAndEmptyArrays: true
                }
            })

            if (fields._id)
                arAggregate[0].$match._id = fields._id
            if (fields.login)
                arAggregate[0].$match.login = fields.login

            const mongoClient = Store.GetMongoClient()
            let collection = mongoClient.collection(`user`)
            let result = await collection.aggregate(arAggregate).toArray()
            if (!result.length) return false
            return result[0]

        } catch (err) {
            console.log(err)
            throw ({...{code: 7001000, msg: 'CUser GetByField'}, ...err})
        }
    }

    //поиск по пользователям
    static async Get(fields) {
        try {
            let arAggregate = []
            arAggregate.push({
                $match:
                    {}
            })
            arAggregate.push({
                $lookup: {
                    from: 'img',
                    localField: 'photo_id',
                    foreignField: '_id',
                    as: '_photo_id'
                }
            })
            arAggregate.push({
                $unwind: {
                    path: '$_photo_id',
                    preserveNullAndEmptyArrays: true
                }
            })

            arAggregate.push({
                $sort: {
                    action_date_last: -1,
                }
            })

            if (fields.q) arAggregate[0].$match.$text = {}
            if (fields.q) arAggregate[0].$match.$text.$search = fields.q

            //сортировка, если поиска нет
            if (fields.q)
                arAggregate.push({
                    $sort: {
                        $score: {$meta:"textScore"}
                    }
                })
            else
                arAggregate.push({
                    $sort: {
                        _id: -1,
                    }
                })

            const mongoClient = Store.GetMongoClient()
            let collection = mongoClient.collection('user')
            let result = await collection.aggregate(arAggregate).skip(fields.offset).limit(fields.count).toArray()
            return result
        } catch (err) {
            console.log(err)
            throw ({...{code: 7001000, msg: 'CUser Get'}, ...err})
        }
    }

    //количество / поиск по пользователям
    static async GetCount(fields) {
        try {
            let arFields = {}
            if (fields.q) arFields = {$text: {$search: fields.q}}

            const mongoClient = Store.GetMongoClient()
            let collection = mongoClient.collection('user')
            let result = await collection.count(arFields)
            return result
        } catch (err) {
            console.log(err)
            throw ({...{code: 7001000, msg: 'CUser GetCount'}, ...err})
        }
    }

    static async Count(fields) {
        try {
            const mongoClient = Store.GetMongoClient()
            let collection = mongoClient.collection('user')

            let result = await collection.count()
            return result

        } catch (err) {
            console.log(err)
            throw ({...{code: 8001000, msg: 'CUser Count'}, ...err})
        }
    }
}

function randomNumber(min, max) {
    return Math.random() * (max - min) + min;
}
