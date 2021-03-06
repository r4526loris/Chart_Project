const fs = require('fs'),
      path = require('path'),
      compression = require('compression'),
      bodyParser = require('body-parser'),
      cookieParser = require('cookie-parser'),
      cookieSession = require('cookie-session'),
      csrf = require('csurf'),
      multer = require('multer'),
      uidSafe = require('uid-safe'),
      knox = require('knox')

let sessionSecret
if(process.env.SESSION_SECRET){
  sessionSecret = process.env.SESSION_SECRET
} else {
  sessionSecret = require('../secrets.json').sessionSecret
}



module.exports.middlewares = function(app){

  app.use(compression())
  app.use(cookieSession({
    secret: sessionSecret,
    maxAge: 1000 * 60 * 60 * 24 * 14
  }))
  app.use(bodyParser.json())
  app.use(cookieParser())
  //prevent csrf attacks
  app.use(csrf());
  app.use(function(req,res,next){
    res.cookie('csrf-token-cookie', req.csrfToken());
    next();
  })

} //end module.exports.middlewares



//image uploading
const diskStorage = multer.diskStorage({
  destination: function (req, file, callback){
    callback(null, path.join(__dirname + '/../uploads'))
  },
  filename: function (req, file, callback){
    uidSafe(24).then(function(uid){
      callback(null, uid + path.extname(file.originalname))
    })
  }
})

module.exports.uploader = multer({
  storage: diskStorage,
  limits: {
    filesize: 8097152
  }
})


//setup 'knox' module to upload files to Amazon S3 Service
let secret = {}
let bucket = 'chart-loris--dev'
if(process.env.NODE_ENV==='production'){
  secret['AWS_KEY'] = process.env.AWS_KEY
  secret['AWS_SECRET'] = process.env.AWS_SECRET
  bucket = 'chart-loris'
} else {
  secret = require('../secrets.json')
}
const client = knox.createClient({
  bucket,
  key: secret.AWS_KEY,
  secret: secret.AWS_SECRET
})

module.exports.uploadToS3 = function(req,res,next){
  const s3Request = client.put(req.file.filename,{
    'Content-Type': req.file.mimetype,
    'Content-Length': req.file.size,
    'x-amz-acl': 'public-read'
  })
  fs.createReadStream(req.file.path).pipe(s3Request)
  s3Request.on('response', function(s3Response){
    if(s3Response.statusCode !== 200){
      res.json({success: false})
    } else {
      fs.unlink(req.file.path,e=>{})
      next()
    }
  })
}
