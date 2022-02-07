import express, { json } from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import joi from 'joi';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import dayjs from 'dayjs';
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect().then(()=>{
     db=mongoClient.db("mywallet");
    });

const app = express();
app.use(cors());
app.use(json());

const signupModel = joi.object({
  email:joi.string().pattern(/@/).required(),
  name: joi.string().required(),
  password: joi.string().required(),
  passwordConfirm: joi.string().required()
}
)

const signinModel = joi.object({
    email:joi.string().required(),
    password: joi.string().required()
})

const transactionModel = joi.object({
    value: joi.number().required(),
    description: joi.string().required()
})

app.post('/signin',async (req,res)=>{
const {email, password} = req.body;
const validation = signinModel.validate(req.body);

if(validation.error){
    return res.status(422).send("Preencha os dados corretamente");
}

try
{
    const user = await db.collection('users').findOne({email:email});
    
    if(!user){
        return res.status(401).send("Usuário não encontrado");
    }
    if(bcrypt.compareSync(password,user.password)){
        const token = uuid();
        await db.collection('sessions').insertOne({token, idUser: user._id});
        return res.status(200).send({token});
    }
}catch(error){
    console.log(error);
    return res.sendStatus(500);
}

    
})
app.post('/signup',async(req,res)=>{
    const newUser=req.body;

    const validation = signupModel.validate(newUser);
    if(validation.error){
        return res.status(422).send("Usuário Inválido");
         
    }
    if(newUser.password !== newUser.passwordConfirm){
        res.status(422).send("Senha e confirmação precisam ser idênticas");
    }
    delete newUser.passwordConfirm;
    const hashedPassword = bcrypt.hashSync(newUser.password,10);

try{
    const existingUser = await db.collection('users').findOne({email:newUser.email});
    if(existingUser){
        return res.status(422).send("Usuário já existe");
    }
    await db.collection('users').insertOne({
        ...newUser,
        password:hashedPassword,
    });

    res.sendStatus(201);
}catch(err){
    console.log(err);
    res.sendStatus(500);
}
})

app.get('/records', async(req,res)=>{
     const auth = req.headers.authorization;
     const token = auth?.replace('Bearer ','');
     console.log(token)
     try{
         const session = await db.collection('sessions').findOne({token});
         if(!session){
            return res.status(401).send("Usuário não encontrado");
         }
         
         const user = await db.collection('users').findOne({_id:session.idUser});
         const transactions = await db.collection('transactions').find({idUser:session.idUser}).toArray();

         res.send({name:user.name, transactions});
     }catch(err){
         console.log(err);
         return res.sendStatus(500);
     }
})

app.post('/income', async (req,res)=>{
const auth = req.headers.authorization;
const token = auth?.replace('Bearer ','');
const transaction = req.body;

const validation = transactionModel.validate(transaction);

if(validation.error){
    return res.sendStatus(422);
}
try{
    const session = await db.collection("sessions").findOne({token});
if(!session){
    return res.sendStatus(401);
}

const user = db.collection('users').findOne({_id:session.idUser});
if(!user){
    return sendStatus(401);
}

await db.collection("transactions").insertOne({
    ...transaction, 
    type:'income',
    date:dayjs(Date.now()).locale('pt-br').format('DD/MM/YYYY'),
    idUser:session.idUser
});
res.sendStatus(201)
}catch(err){
    console.log(err);
    res.sendStatus(500);
}


});

app.post('/outcome',async (req,res)=>{
const auth = req.headers.authorization;
const token = auth?.replace('Bearer ','');
const transaction = req.body;

const validation = transactionModel.validate(transaction);

if(validation.error){
    return res.sendStatus(422);
}
try{
    const session = await db.collection("sessions").findOne({token});
if(!session){
    return res.sendStatus(401);
}

const user = db.collection('users').findOne({_id:session.idUser});
if(!user){
    return sendStatus(401);
}

await db.collection("transactions").insertOne({
    ...transaction, 
    type:'outcome',
    date:dayjs(Date.now()).locale('pt-br').format('DD/MM/YYYY'),
    idUser:session.idUser
});
res.sendStatus(201)
}catch(err){
    console.log(err);
    res.sendStatus(500);
}

})
app.listen(5000,()=> console.log("Initialized Server..."))


