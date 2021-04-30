import nextConnect from 'next-connect';
import multer from 'multer';
import {spawn} from 'child_process';
import glob from 'glob';
import fs, { unlink } from 'fs';

const SAVEDIR = "public/pdfs/split";

const upload = multer({
  storage: multer.diskStorage({
    destination: './public/pdfs',
    filename: (req, file, cb) => cb(null, file.originalname),
  }),
});

const apiRoute = nextConnect({

  onError(error, req, res) {
      console.log("OK SEEN AN ERROR!!");
    res.status(501).json({ error: `Sorry something Happened! ${error.message}` });
  },
  onNoMatch(req, res) {
    res.status(405).json({ error: `Method '${req.method}' Not Allowed` });
  },
});

const splitter = (req,res,next)=>{
    
    const [file=""] = req.files;
    glob(`${SAVEDIR}/*.jpg`, {},  (er, files)=>{
       files.map(f=>{
           try{
               fs.unlinkSync(f);
           }catch(err){}
        });
    });

    const convert = spawn("mudraw", ["-w", "1920" ,"-h", "1080", "-r", "200", "-c", "rgb", "-o", `./${SAVEDIR}/slide%d.jpg`, file.path || ""])

    convert.stdout.on('data', (data) => {
        //console.log(`stdout: ${data}`);
    });
    
    convert.stderr.on('data', (data) => {
        //console.log(`stderr: ${data}`);
    });
    
    convert.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
        var re = new RegExp(`${SAVEDIR}/`, "g");
        if (code === 0){
            glob(`${SAVEDIR}/*.jpg`, {},  (er, files)=>{
                req.nodes = files.map(f=>f.replace(re,""))
                next();
            })
        }else{
            next(Error("oh no!"));
        }
        
    });
}

apiRoute.use(upload.array('thePdf')).use(splitter);

apiRoute.post((req, res) => {
  const {nodes=[]} = req;
  res.status(200).json({nodes,path:SAVEDIR.replace(/^public/, "")});
});

export default apiRoute;

export const config = {
  api: {
    bodyParser: false, // Disallow body parsing, consume as stream
  },
};