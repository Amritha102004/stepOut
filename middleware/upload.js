require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { v4: uuidv4 } = require('uuid');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const productId = req.query.id || req.params.id || `new-${Date.now()}`;
        const fieldName = file.fieldname;
        const uniqueId = uuidv4().substring(0, 8);
        
        return {
            folder: 'products',
            public_id: `${productId}-${fieldName}-${uniqueId}`,
            format: 'webp',
            transformation: [
                { width: 800, height: 800, crop: 'fill' },
                { quality: 80 }
            ],
            overwrite: true
        };
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 
    }
});

module.exports = upload;
