const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const User = require('./models/user.model')
const Admin = require('./models/admin')
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Trader = require('./models/trader')
dotenv.config()

const app = express()


const jwtSecret = process.env.JWT_SECRET;


app.use(cors())
app.use(express.json())

mongoose.connect(process.env.ATLAS_URI).then(() => {
    console.log('Connected to MongoDB');
})
.catch((error) => {
    console.error('Error connecting to MongoDB:', error);
});

app.post('/api/verify', async (req, res) => {
  const  {
    id
  } = req.body
  const user = await User.findOne({ _id: id })
  
  console.log(user)
  try {
    if (user.verified) {
      await User.updateOne({ _id: id }, {
          verified: false
      })
      res.json({
        status: 200,verified:user
    })
    }
    else {
     await User.updateOne({ _id: id }, {
          verified: true
      })
      res.json({
        status: 201,verified:user
    })
    }
  } catch (error) {
    res.json({ status:400, message: `error ${error}` })
  }
})

app.post('/api/copytrade', async (req, res) => {
  const token = req.headers['x-access-token']
  const trader = req.body.trader
  try {
    const decode = jwt.verify(token, jwtSecret)
    const email = decode.email
    const user = await User.findOne({ email: email })

    const Trader = await User.updateOne
      ({ email: user.email },
      { trader: trader })
    
    res.json({ status:200, message:'trader successfully added',trader:Trader })
   
  } catch (error) {
    res.json({ status: 400,message: `error ${error}`})
  }
})

// register route 
app.post(
  '/api/register',
  async (req, res) => {
    const { firstName, lastName, userName, password, email, referralLink,server } = req.body;
    const now = new Date();

    try {
      // Check if the user already exists
      const existingUser = await User.findOne({ email:email });
      if (existingUser) {
        return res.status(409).json({ status: 'error', message: 'Email or username already exists' });
      }

      // Check for referring user
      const referringUser = await User.findOne({ username: referralLink });
      if (referringUser) {

        // Update referring user's referral info

        await User.updateOne(
          { username: referralLink },
          {
            $push: {
              referred: {
                firstname: firstName,
                lastname: lastName,
                email: email,
                date: now.toLocaleString(),
                refBonus: 15,
              },
            },
            refBonus: referringUser.refBonus + 500,
            totalProfit: referringUser.totalProfit + 15,
            funded: referringUser.funded + 15,
            capital : referringUser.capital + 15
          }
        );
      }

      // Create a new user
      const newUser = await User.create({
        firstname: firstName,
        lastname: lastName,
        username: userName,
        email,
        password: password,
        funded: 0,
        investment: [],
        transaction: [],
        withdraw: [],
        rememberme: false,
        referral: crypto.randomBytes(32).toString('hex'),
        refBonus: 0,
        referred: [],
        periodicProfit: 0,
        upline: referralLink || null,
        trades: [],
        server:server || "server1"
      });

      // Generate JWT token
      const token = jwt.sign(
        { id: newUser._id, email: newUser.email },
        process.env.JWT_SECRET || 'secret1258', // Use environment variable for security
        { expiresIn: '1h' }
      );

      // Prepare response data
      const response = {
        status: 'ok',
        email: newUser.email,
        name: newUser.firstname,
        token,
        adminSubject: 'User Signup Alert',
        message: `A new user with the following details just signed up:\nName: ${firstName} ${lastName}\nEmail: ${email}`,
        subject: 'Successful User Referral Alert',
      };

      if (referringUser) {
        response.referringUserEmail = referringUser.email;
        response.referringUserName = referringUser.firstname;
        response.referringUserMessage = `A new user with the name ${firstName} ${lastName} just signed up with your referral link. You will now earn 10% of every deposit this user makes. Keep referring to earn more.`;
      } else {
        response.referringUser = null;
      }

      return res.status(201).json(response);
    } catch (error) {
      console.error('Error during user registration:', error);
      return res.status(500).json({ status: 'error', message: 'Server error. Please try again later.' });
    }
  }
);

app.get('/:id/refer', async(req,res)=>{
  try {
    const user = await User.findOne({username:req.params.id})
    if(!user){
      return res.json({status:400})
    }
    res.json({status:200,referredUser:req.params.id})
  } catch (error) {
    console.log(error)
    res.json({status:`internal server error ${error}`})
  }
})


app.get('/api/getData', async (req, res) => {
  const token = req.headers['x-access-token'];
  try {
    // Ensure token is provided
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'No token provided' });
    }

    // Verify token and decode user details
    const decoded = jwt.verify(token, jwtSecret); // Replace 'secret1258' with an environment variable for better security
    const email = decoded.email;

    // Fetch user data
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    // Respond with user details
    res.status(200).json({
      status: 'ok',
      firstname: user.firstname,
      lastname: user.lastname,
      username: user.username,
      email: user.email,
      funded: user.funded,
      invest: user.investment,
      transaction: user.transaction,
      withdraw: user.withdraw,
      refBonus: user.refBonus,
      referred: user.referred,
      referral: user.referral,
      phonenumber: user.phonenumber,
      state: user.state,
      zipcode: user.zipcode,
      address: user.address,
      profilepicture: user.profilepicture,
      country: user.country,
      totalprofit: user.totalprofit,
      totaldeposit: user.totaldeposit,
      totalwithdraw: user.totalwithdraw,
      deposit: user.deposit,
      promo: user.promo,
      periodicProfit: user.periodicProfit,
      trader: user.trader,
      rank: user.rank,
      server: user.server,
      trades: user.trades,
      verified:user.verified
    });
  } catch (error) {
    console.error('Error fetching user data:', error.message);

    // Differentiate between invalid token and server error
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ status: 'error', message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ status: 'error', message: 'Token expired' });
    }

    // Handle other server errors
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});



app.post('/api/updateUserData', async (req, res) => {
  const token = req.headers['x-access-token'];

  try {
    const decode = jwt.verify(token, jwtSecret);
    const email = decode.email;
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.json({ status: 400, message: "User not found" });
    }

    // Prepare an object to hold only changed fields
    let updatedFields = {};

    // Loop through request body and compare with existing user data
    Object.keys(req.body).forEach((key) => {
      if (req.body[key] !== undefined && req.body[key] !== user[key]) {
        updatedFields[key] = req.body[key];
      }
    });

    // Ensure email remains unchanged
    delete updatedFields.email;

    // Update only if there are changes
    if (Object.keys(updatedFields).length > 0) {
      await User.updateOne({ email: user.email }, { $set: updatedFields });
      return res.json({ status: 200, message: "Profile updated successfully" });
    }

    return res.json({ status: 400, message: "No changes were made" });

  } catch (error) {
    console.error(error);
    return res.json({ status: 500, message: "Internal server error" });
  }
});




app.post('/api/fundwallet', async (req, res) => {
  try {
    const email = req.body.email
    const incomingAmount = req.body.amount
    const user = await User.findOne({ email: email })
    await User.updateOne(
      { email: email },{
      $set : {
        funded: incomingAmount + user.funded,
        capital :user.capital + incomingAmount,
        totaldeposit: user.totaldeposit + incomingAmount
      }}
    )
    const upline = await User.findOne({ username: user.upline })
    if (upline) {
      await User.updateOne({ username: user.upline }, {
        $set: {
          refBonus: 10 / 100 * incomingAmount,
          totalprofit: upline.totalprofit + (10 / 100 * incomingAmount),
          capital: upline.capital + (10 / 100 * incomingAmount),
          funded: upline.funded + (10 / 100 * incomingAmount),
        }
      })
    }

    await User.updateOne(
      { email: email },
      {
        $push : {
          deposit:{
            date:new Date().toLocaleString(),
            amount:incomingAmount,
            id:crypto.randomBytes(32).toString("hex"),
            balance: incomingAmount + user.funded}
        },transaction: {
          type:'Deposit',
          amount: incomingAmount,
          date: new Date().toLocaleString(),
          balance: incomingAmount + user.funded,
          id:crypto.randomBytes(32).toString("hex"),
      }}
    )

    if (upline) {
        res.json({
        status: 'ok',
        funded: req.body.amount,
        name: user.firstname,
        email: user.email,
        message: `your account has been credited with $${incomingAmount} USD. you can proceed to choosing your preferred investment plan to start earning. Thanks.`,
        subject: 'Deposit Successful',
        uplineName: upline.firstname,
        uplineEmail: upline.email,
        uplineSubject: `Earned Referral Commission`,
        uplineMessage:`Congratulations! You just earned $${10/100 * incomingAmount} in commission from ${user.firstname} ${user.lastname}'s deposit of $${incomingAmount}.`
    })
    }
    else {
      res.json({
      status: 'ok',
      funded: req.body.amount,
      name: user.firstname,
      email: user.email,
      message: `your account has been credited with $${incomingAmount} USD. you can proceed to choosing your preferred investment plan to start earning. Thanks.`,
      subject: 'Deposit Successful',
      upline:null
    })
    }
    
  } catch (error) {
    console.log(error)
    res.json({ status: 'error' })
  }
})

app.post('/api/admin', async (req, res) => {
  const admin = await Admin.findOne({email:req.body.email})
  if(admin){
      return res.json({status:200,token:'token'})
  }
  else{
    return res.json({status:400})
  }
})


app.post('/api/deleteUser', async (req, res) => {
  try {
      await User.deleteOne({email:req.body.email})
      return res.json({status:200})
  } catch (error) {
    return res.json({status:500,msg:`${error}`})
  }
})

app.post('/api/deleteTrader', async (req, res) => {
  try {
      await Trader.deleteOne({_id:req.body.id})
      return res.json({status:200})
  } catch (error) {
    return res.json({status:500,msg:`${error}`})
  }
})

app.post('/api/upgradeUser', async (req, res) => {
  try {
    const email = req.body.email
    const incomingAmount = req.body.amount
    const user = await User.findOne({ email: email })
    if (user) {
      await User.updateOne(
        { email: email }, {
        $set: {
          funded: incomingAmount + user.funded,
          capital: user.capital + incomingAmount,
          totalProfit: user.totalprofit + incomingAmount,
          periodicProfit: user.periodicProfit + incomingAmount
        }
      }
      )
      res.json({
        status: 'ok',
        funded: req.body.amount
      })
    }
  }
  catch (error) {
    res.json({
        status: 'error',
      })
  }
    

})


app.post('/api/updateTraderLog', async (req, res) => {
  try {
    const {
      tradeLog
    } = req.body
    // const tradeLog = req.body.tradeLog
    const id = tradeLog.id
      const updatedTrader = await Trader.updateOne(
        { _id: id }, {
          $push: {
            tradehistory : tradeLog
          }
      }
    )
    if (tradeLog.tradeType === 'profit') {
          const updatedUsers = await User.updateMany({ trader: id }, {
          $push: {
                trades : tradeLog
          },
          $inc: {
              funded: tradeLog.amount,
              capital: tradeLog.amount,
              totalProfit: tradeLog.amount, 
            }
        })
        res.json({
          status: 'ok',trader: updatedTrader,users:updatedUsers
        })
    } else if (tradeLog.tradeType === 'loss') {
      const updatedUsers = await User.updateMany({ trader: id }, {
          $push: {
                trades : tradeLog
          },
          $inc: {
              funded: -tradeLog.amount,
              capital: -tradeLog.amount,
              totalProfit: -tradeLog.amount, 
            }
        })
        res.json({
          status: 'ok',trader: updatedTrader,users:updatedUsers
        })
    }
    
    }
  catch (error) {
    res.json({
        status: 'error',
      })
  }
})

app.post('/api/withdraw', async (req, res) => {
  const token = req.headers['x-access-token']
  try {
    const decode = jwt.verify(token, jwtSecret)
    const email = decode.email
    const user = await User.findOne({ email: email })
    if (user.funded >= req.body.WithdrawAmount ) {
      await User.updateOne(
        { email: email },
        { $set: { funded: user.funded - req.body.WithdrawAmount, totalwithdraw: user.totalwithdraw + req.body.WithdrawAmount, capital: user.capital - req.body.WithdrawAmount, totalprofit: user.totalprofit - req.body.WithdrawAmount }}
      )
      await User.updateOne(
        { email: email },
        { $push: { withdraw: {
          date:new Date().toLocaleString(),
          amount:req.body.WithdrawAmount,
          id:crypto.randomBytes(32).toString("hex"),
          balance: user.funded - req.body.WithdrawAmount
        } } }
      )
      const now = new Date()
      await User.updateOne(
        { email: email },
        { $push: { transaction: {
          type:'withdraw',
          amount: req.body.WithdrawAmount,
          date: now.toLocaleString(),
          balance: user.funded - req.body.WithdrawAmount,
          id:crypto.randomBytes(32).toString("hex"),
        } } }
      )
      return res.json({
            status: 'ok',
            withdraw: req.body.WithdrawAmount,
            email: user.email,
            name: user.firstname,
            message: `We have received your withdrawal order, kindly exercise some patience as our management board approves your withdrawal`,
            subject: 'Withdrawal Order Alert',
            adminMessage: `Hello BOSS! a user with the name ${user.firstname} placed withdrawal of $${req.body.WithdrawAmount} USD, to be withdrawn into ${req.body.wallet} ${req.body.method} wallet`,
      })
    }
   
  else{
      res.json({
      status: 400,
      subject:'Failed Withdrawal Alert',
      email: user.email,
      name: user.firstname,
      withdrawMessage:`We have received your withdrawal order, but you can only withdraw you insufficient amount in your account. Kindly deposit and invest more, to rack up more profit, Thanks.`
      })
  }}
   catch (error) {
    console.log(error)
    res.json({ status: 'error',message:'internal server error' })
  }
})

app.post('/api/sendproof', async (req,res)=>{
  const token = req.headers['x-access-token']
  try {
    const decode = jwt.verify(token, jwtSecret)
    const email = decode.email
    const user = await User.findOne({ email: email })
    if(user){
            return res.json({
            status: 200,
            email: user.email,
            name: user.firstname,
            message: `Hi! you have successfully placed a deposit order, kindly exercise some patience as we verify your deposit. Your account will automatically be credited with $${req.body.amount} USD after verification.`,
            subject: 'Pending Deposit Alert',
            adminMessage: `hello BOSS, a user with the name.${user.firstname}, just deposited $${req.body.amount} USD into to your ${req.body.method} wallet. please confirm deposit and credit.`,
            adminSubject:'Deposit Alert'
      })
    }
    else{
      return res.json({status:500})
    }
  } catch (error) {
    console.log(error)
    res.json({ status: 404 })
    }
})



const SECRET_KEY = process.env.JWT_SECRET || 'defaultsecretkey'; // Replace with your actual secret stored in .env

app.post('/api/login', async (req, res) => {
  try {
    const { email, password, rememberme } = req.body;

    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ status: 404, message: 'User does not exist' });
    }

    // Verify password
    // const isPasswordValid = await bcrypt.compare(password, user.password);
    if (password != user.password) {
      return res.json({ status: 401, message: 'Incorrect password' });
    }

    // Generate JWT token with user ID and email
    const token = jwt.sign(
      { id: user._id, email: user.email },
      SECRET_KEY,
      { expiresIn: '7d' } // Set token to expire in 7 days
    );

    // Update the user's "remember me" status
    user.rememberme = rememberme || false;
    await user.save();

    // Send response
    return res.status(200).json({
      status: 'ok',
      token,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Error during login:', error);
    return res.json({ status: 'error', message: 'Internal server error' });
  }
});


app.get('/api/getUsers', async (req, res) => {
  const users = await User.find()
  res.json(users)
})


app.post('/api/invest', async (req, res) => {
  const token = req.headers['x-access-token']
  try {
    const decode = jwt.verify(token, jwtSecret)
    const email = decode.email
    const user = await User.findOne({ email: email })

    const money = (() => {
      switch (req.body.percent) {
        case '20%':
          return (req.body.amount * 20) / 100
        case '35%':
          return (req.body.amount * 35) / 100
        case '50%':
          return (req.body.amount * 50) / 100
        case '65%':
          return (req.body.amount * 65) / 100
        case '80%':
          return (req.body.amount * 80) / 100
        case '100%':
          return (req.body.amount * 100) / 100
      }
    })()
    if (user.capital >= req.body.amount) {
      const now = new Date()
      await User.updateOne(
        { email: email },
        {
          $set: {capital : user.capital - req.body.amount, totalprofit : user.totalprofit + money ,withdrawDuration: now.getTime()},
        }
      )
      await User.updateOne(
        { email: email },
        { $push: {
          investment:
          {
            type: 'investment',
            amount: req.body.amount,
            plan: req.body.plan,
            percent: req.body.percent,
            startDate: now.toLocaleString(),
            endDate: now.setDate(now.getDate() + 432000).toLocaleString(),
            profit: money,
            ended: 259200000,
            started: now.getTime(),
            periodicProfit: 0
          },
          transaction: {
            type: 'investment',
            amount: req.body.amount,
            date: now.toLocaleString(),
            balance: user.funded + req.body.amount,
            id: crypto.randomBytes(32).toString("hex")
          }
        }
      }
      )
      res.json({ status: 'ok', amount: req.body.amount })
    } else {
      res.json({
        message: 'Insufficient capital!',
        status:400
      })
    }
  } catch (error) {
    return res.json({ status: 500 , error: error})
  }
})


const change = (users, now) => {
  users.forEach((user) => {
     
    user.investment.map(async (invest) => {
      if (isNaN(invest.started)) {
        console.log('investment is not a number')
        res.json({message:'investment is not a number'})
        return
      }
      if (user.investment == []) {
        console.log('investment is an empty array')
        res.json({message:'investment is an empty array'})
        return
      }
      if (now - invest.started >= invest.ended) {
        console.log('investment completed')
        res.json({message:'investment completed'})
        return
      }
      if (isNaN(invest.profit)) {
        console.log('investment profit is not a number')
        res.json({message:'investment profit is not a number'})
        return
      }
      else{
      try {
        await User.updateOne(
          { email: user.email },
          {
            $set:{
              funded:user.funded + invest.profit,
              periodicProfit:user.periodicProfit + invest.profit,
              capital: user.capital + invest.profit,
              totalProfit : user.totalProfit + invest.profit
            }
          }
        )
      } catch (error) {
        console.log(error)
      }}
 })
})
} 
app.get('/api/cron', async (req, res) => {
  try {
      const users = (await User.find()) ?? []
      const now = new Date().getTime()
      change(users, now)
      return res.json({status:200})
  } catch (error) {
    console.log(error)
    return res.json({status:500, message:'error! timeout'})
  }
})


app.post('/api/getWithdrawInfo', async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.body.email,
    })
    if(user){
    const userAmount = user.withdraw[user.withdraw.length - 1].amount
    return res.json({ status: 'ok', amount: userAmount})
    }
  }
  catch(err) {
      return res.json({ status: 'error', user: false })
    }
})

// Create new trader
app.post('/api/createTrader', async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      nationality,
      winRate, // this doesn't exist in the model, maybe map to profitrate?
      avgReturn,
      followers,
      rrRatio,
      minimumcapital,
      traderImage
    } = req.body;

    const newTrader = new Trader({
      firstname,
      lastname,
      nationality,
      profitrate: winRate || '92%', // mapping winRate from frontend
      averagereturn: avgReturn || '90%',
      followers: followers || '50345',
      rrRatio: rrRatio || '1:7',
      minimumcapital: minimumcapital || 5000,
      tradehistory: [], // empty by default
      numberoftrades: '64535', // or set it dynamically later
      traderImage: traderImage
    });

    const savedTrader = await newTrader.save();
    res.status(201).json(savedTrader);
  } catch (error) {
    console.error('Error creating trader:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

app.get('/api/fetchTraders', async (req, res) => {
  try {
    const traders = await Trader.find()
    res.json({ status: 200, traders: traders })
  }
  catch (error) {
    res.json({ status: 404, error: error })
  }
})

module.exports = app

