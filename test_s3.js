const { S3Client, HeadBucketCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({ region: "ap-south-1", credentials: { accessKeyId: "fake", secretAccessKey: "fake" } });
s3.send(new HeadBucketCommand({ Bucket: "testb" })).catch(console.log);
