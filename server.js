/*
* Author: Dmytro I Dundukov 
* SHORT DESC: BackEnd for BDEnergy 
* LONG DESC: This file contains all the BackEnd logic for BDEnergy website
*			TODO: needs to be connected to the FrontEnd, and checked for bugs. 
*/
// import express library(actual server library)
const express = require('express');
// import body-parser(need it to extract data from JSON)
const bodyParser = require('body-parser');
// import bycrypt to encrypt the passwords
const bcrypt = require('bcrypt-nodejs');
// import cors library to allow the front end to connect to the back end 
const cors = require('cors');
// import knox library for the database
const knex = require('knex');
// create inst of express(server)
const app = express();
// connect to the database
const db = knex ({
	client: 'pg',
	connection: {
		host: '127.0.0.1',
		user: 'postgres',
		password: 'DunDmy12',
		database: 'BDEnergy'
	}
});
// use bady parser(MiddleWare)
app.use(bodyParser.json());
// use cors (MiddleWare)
app.use(cors());

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//TESTING connection
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
console.log(db.select('*').from('USER_LOGIN'));
db.select('*').from('USER_LOGIN').then(data =>{
	console.log(data);
})
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
													//WELCOME PAGE(SIGNING AND REGISTER)
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// creatging a back end for signin
// use POSTMAN to check http://localhost:3000/signin
// use .json instead of .send since express comes with the json funcion
// users information will comde from front end inside "req"
app.post('/signin', (req,res) => {
	// SELECT user name from USER_LOGIN Table
	db.select('USER_EMAIL', 'USER_PASSWORD').from('USER_LOGIN')
		.where('USER_EMAIL', '=', req.body.user)
		// .then is a callback function used run another stmt.
		// .then takes to args 1. success 2. error handler
		.then(data => { 
			// returns true if passwords match
			const isValid = bcrypt.compareSync(req.body.password, data[0].USER_PASSWORD);
			console.log(data);
			if(isValid){
				console.log(req.body.user);
				db.select('*').from('USER_INFO')
						.then(user =>{
							console.log(user[0].USER_EMAIL);
							//res.json(user);
						})
				// selects the correct user from USER_INFO Table
				return db.select('*').from('USER_INFO')
						.where({'USER_EMAIL' : req.body.user})
						.then(user =>{
							console.log(user);
							res.json(user);
						})
						.catch(err => res.status(400).json('unable to get user'))
			}else{
				res.status(400).json('wrong credentials ELSE')
			}
		})
		.catch(err=>res.status(400).json('wrong credentials'))
})

// creating a back end for register
// use POSTMAN to check http://localhost:3000/register
app.post('/register', (req, res) => {
	// create a hash from password
	const hash = bcrypt.hashSync(req.body.registerPassword);
	// creates the database connection. 
	// All queries within a transaction are executed on the same database connection, and run the entire set of queries as a single unit of work
	// Any failure will mean the database will rollback any queries executed on that connection to the pre-transaction state.
	// When updating multiple tables. If one fails then all fails.
	db.transaction(trx => {
		trx.insert({
			USER_PASSWORD: hash,
			USER_EMAIL: req.body.userEmail
		})
		.into('USER_LOGIN')
		//specifies which column should be returned by the insert and update methods
		.returning('USER_EMAIL')
		// response for query above
		.then(loginEmail => {
			return trx('USER_INFO')
					//specifies which column should be returned by the insert and update methods
					.returning('*')
					.insert({
						USER_EMAIL: loginEmail[0],
						USER_FNAME: "",
						USER_LNAME: "",
						IS_ADMIN: false
					})
					.then(user => {
						res.json(user[0])
					})
		})
		.then(trx.commit)
		.catch(trx.rollback)
	})
	.catch(err=>res.status(400).json('unable to register'))
})
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
													//SHOPPING PAGE
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// loads the list of products that are curently available
// Not on sale
app.get('/shoppingpage/products' , (req,res) => {
	db.select('*')
		.from('PRODUCT_INFO')
		.whereNot('ON_SALE', false )
		.then(products => {
			res.send(products);
		})
		.catch(err=>res.status(400).json('list of projects cannot be displayed'))

})

//Loads the list of products that are currently on sale
app.get('/shoppingpage/productsOnSale' , (req,res) => {
	db.select('*')
		.from('PRODUCT_INFO')
		.whereNot('ON_SALE', true )
		.then(products => {
			res.json(products);
		})
		.catch(err=>res.status(400).json('list of projects cannot be displayed'))
})
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
													//SHOPPING CART
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// allows user to add the item to the shopping cart
// insert the item that has been added to the shopping cart into XREF table
// PRODUCT_PURCHASED will always be false when added to the shopping cart
// TIME_STAMP will be created by the new DATE() js function on the front end
app.post('/shoppingpage/shoppingcart/', (req,res) => {
	db.insert({
		USER_ID: req.body.id,
		PROD_ID: req.body.prod,
		TIME_STAMP: req.body.time_stamp,
		PROD_QUANTITY: req.body.quantity,
		PROD_PURCHASED: false
	})
	.into('XREF_USER_PRODUCT')
	.then(product => {
		res.json(product)
	})
	.catch(err=>res.status(400).json('unable to add the item to the shoppingcart'))
})

// completely removes the item from the shopping cart
// after delete the user will not be able to see this item inside his shopping cart
// will be removed from XREF_USER_PRODUCT
app.delete('/shoppingpage/shoppingcart/:id/:item', (req,res) => {
	db.delete().from('XREF_USER_PRODUCT')
		.where({
			USER_ID: req.params.id,
			PROD_ID: req.params.item
		})
		.then(product => {
			res.json(product);
		})
		.catch(err=>res.status(400).json('unable to delete the item from the shoppingcart'))
})

// will update the quantity of the item inside user's shopping cart
// also update the history when item was added
app.put('/shoppingpage/shoppingcart/:id/:item/:quantity/:time_stamp', (req, res) => {
	db.update({
		PROD_QUANTITY: req.params.quantity,
		TIME_STAMP: req.params.time_stamp
	})
	.from('XREF_USER_PRODUCT')
	.where({
		USER_ID: req.params.id,
		PROD_ID: req.params.item
	})
	.then(product => {
		res.json(product);
	})
	.catch(err=>res.status(400).json('cannot update quantity'))
})

// will set purchased to true after confirming the checkout process
// this way the purchased item will not be shown inside the user's shopping cart
app.put('/shoppingpage/shoppingcart/:id/:item', (req, res) => {
	db.update({
		PROD_PURCHASED: true
	})
	.from('XREF_USER_PRODUCT')
	.where({
		USER_ID: req.params.id,
		PROD_ID: req.params.item
	})
	.then(product => {
		res.json(product);
	})
	.catch(err=>res.status(400).json('cannot checkout'))
})

app.get('/shoppingpage/shoppingcart/:id', (req, res) => {
	db.select('*')
	.from('PRODUCT_INFO')
	.innerJoin('XREF_USER_PRODUCT', 'PRODUCT_INFO.PROD_ID', 'XREF_USER_PRODUCT.PROD_ID')
	.then(product => {
		res.json(product)
	})
	.catch(err=>res.status(400).json('cannot display the shoppingcart'))
	})
// SELECT *
// FROM "PRODUCT_INFO" tb1, "XREF_USER_PRODUCT" tb2
// WHERE tb1."PROD_ID" = tb2."PROD_ID"
// from('users').innerJoin('accounts', 'users.id', 'accounts.user_id')


//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
																//USER INFORMATION
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// updates and saves user information
// TODO: updates everything exept the password
app.put('/shoppingpage/updateUser/:id/:email/:fname/:lname', (req,res) => {
	db.transaction(trx => {
		trx.update({			
			USER_EMAIL: req.params.email,
			USER_FNAME: req.params.fname,
			USER_LNAME: req.params.lname
		})
		.from('USER_INFO')
		.where('USER_ID', '=', req.params.id)
		//specifies which column should be returned by the insert and update methods
		.returning('USER_EMAIL')
		// response for query above
		.then(loginEmail => {
			return trx('USER_LOGIN')
			.update({
				USER_EMAIL: loginEmail[0]
			})
			.where('USER_ID', '=', req.params.id)
			.then(user => {
				res.json('user information has been updated')
			})
		})
		.then(trx.commit)
		.catch(trx.rollback)
	})
	.catch(err=>res.status(400).json('unable to update user information'))
})
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
																//ADMIN PAGE
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//adds a new item to the database. this will be used by the admin only
//all the items that are added by the admin will show up on the dynamic search
app.post('/shoppingcart/admin/add', (req,res) => {
		console.log(req.body)
		db.insert({
			PROD_NAME: req.body.prod,
			PROD_DESC: req.body.desc,
			PROD_PRICE: req.body.price,
			
			ON_SALE: req.body.sale,
			SALE_START_DATE: req.body.saleStart,
			SALE_END_DATE: req.body.saleEnd,
			SALE_PRICE: req.body.salePrice,

			IS_PROMO: req.body.promo,
			PROMO_PRICE: req.body.promoPrice,
			PROMO_CODE: req.body.promoCode,
			PROMO_START_DATE: req.body.promoStart,
			PROMO_END_DATE: req.body.promoEnd,
			//PROD_QUANTITY: req.body.numAvail, //TODO: ADD
			PROD_IMAGE: req.body.image,

		})
		.into('PRODUCT_INFO')
		.returning('*')
		.then(product => {
			res.json(product);
		})
		.catch(err=>res.status(400).json('unable to insert a new product'))
})
// loads the list of products that are curently available
// Not on sale
app.get('/shoppingpage/admin/products/', (req,res) => {
	db.select('*')
		.from('PRODUCT_INFO')
		.then(products => {
			res.json(products);
		})
		.catch(err=>res.status(400).json('list of projects cannot be displayed'))

})
//removes an item from the list in the database. this will allow admin to remove
//items that are listed on the dynemic search
app.delete('/shoppingcart/admin/remove/:id', (req,res) => {
	db.delete().from('PRODUCT_INFO')
		.where('PROD_ID','=', req.params.id)
		.then(product => {
			res.json(product);
		})
		.catch(err=>res.status(400).json('unable to delete the item'))
})

//updates the item information
//the admin can change any item information
app.post('/shoppingcart/admin/update/', (req, res) => {
	db.update({
			PROD_NAME: req.body.prod,
			PROD_DESC: req.body.desc,
			PROD_PRICE: req.body.price,
			
			ON_SALE: req.body.sale,
			//SALE_START_DATE: req.body.saleStart,
			//SALE_END_DATE: req.body.saleEnd,
			SALE_PRICE: req.body.salePrice,

			IS_PROMO: req.body.promo,
			//PROMO_PRICE: req.body.promoPrice,
			//PROMO_CODE: req.body.promoCode,
			//PROMO_START_DATE: req.body.promoStart,
			//PROMO_END_DATE: req.body.promoEnd,
			//PROD_QUANTITY: req.body.numAvail, //TODO: ADD
			//PROD_IMAGE: req.body.image,
		})
		.from('PRODUCT_INFO')
		.where('PROD_ID', '=', req.body.id)
		.returning('*')
		.then(product => {
			res.json(product);
		})
		.catch(err=>res.status(400).json('item has not been updated'))
})

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// creating a shopping page for logged in user who just added an item to his/her shopping cart
// TO DO: need code to add to the shopping cart
app.post('/shoppingpage/:id/:item', (req,res) => {
})

// listen on port 3000
app.listen(3000, ()=> {
	console.log('app is running on PORT:3000')
})

// //encrypts the passwords
// bcrypt.hash("bacon", null, null, function(err, hash) {
//     // Store hash in your password DB.
// 



/*
/ --> res = this is working
/welcome
/signin --> POST = success/fail
/register --> POST = return user
/shoppingpage/:id --> GET = return user (show the shopping cart page to the registered user)
			          --> PUT = add items to the shopping cart
/shoppingpage/guest --> return guest
/shoppingpage/guest/shoppingcart --> guest views his/her shopping cart
/shoppingpage/guest --> guest checks out --> geust
/shoppingpage/:userId/shoppingcart --> GET = current items inside the shopping cart
								   --> PUT = delete/add items form shopping cart
/shoppingpage/:userId/shoppingcart/checkout --> PUT = update database when checkedout
/shoppingpage/:userId/shoppingcart/admin --> PUT = add/delete/set promotions/ 
/
*/