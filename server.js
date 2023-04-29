require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "profile_pictures",
    public_id: (req, file) => `profile_picture_${new Date().toISOString()}`,
  },
});

const salt = 10;
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ credentials: true, origin: process.env.FRONTEND_URL }));
app.use(express.json());

const upload = multer({ storage: storage });
mongoose
  .connect(
    `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}?retryWrites=true&w=majority`,
    { dbName: process.env.DB_NAME }
  )
  .then(() => {
    console.log("Database connected");
  })
  .catch((err) => {
    console.log(err);
  });
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: { type: String, unique: true },
  data: { type: String },
  profilePicture: String,

});
const User = mongoose.model("User", userSchema);
app.get("/register", (req, res) => {
  res.send(
    `<div>
      <form method="post" enctype="multipart/form-data">
        <input type="email" placeholder="email" name="email" />
        <input type="password" placeholder="password" name="password" />
        <input type="file" name="profilePicture" />
        <button>erstellen</button>
      </form>
    </div>`
  );
});
app.post("/register", upload.array("profilePicture"), async (req, res) => {
  const { email, password } = req.body;
  try {
    // console.log(req.files);
    const hash = await bcrypt.hash(password, salt);
    const user = new User({ email, password: hash, data: new Date() });
    await user.save();
    // const user = await User.create({
    //   email,
    //   password: hash,
    //   profilePicture,
    // });
    const foundUser = await User.findOne({ email });
    jwt.sign(
      { email: foundUser.email, id: foundUser._id },
      process.env.SECRET,
      (err, token) => {
        if (err) {
          console.log(err);
        } else {
          console.log(token);
        }
        res
          .cookie("token", token, {
            httOnly: true,
            SameSite: "Lax",
            maxAge: 24 * 60 * 60 * 1000, // one day
          })
          .redirect("/profile");
      }
    );
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});
app.get("/login", (req, res) => {
  res.send(
    `<div>
      <form method="post">
        <input type="email" placeholder="email" name="email" />
        <input type="password" placeholder="password" name="password" />
        <button>login</button>
      </form>
    </div>`
  );
});
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const foundUser = await User.findOne({ email });
  if (!foundUser) {
    return res.json({ msg: "email not exist" });
  }
  // email ist richtig

  const passwordOK = await bcrypt.compare(password, foundUser.password);

  if (!passwordOK) {
    return res.json({ msg: "credentials error" });
  }
  console.log("password ok!", passwordOK);

  jwt.sign(
    { email: foundUser.email, id: foundUser._id },
    process.env.SECRET,
    (err, token) => {
      if (err) {
        req.send(err);
      }
      res
        .cookie("token", token, {
          httOnly: true,
          SameSite: "Lax",
          maxAge: 24 * 60 * 60 * 1000, // one day
        })
        .json({ msg: "you are logged in!" });
      //.redirect("/profile");
    }
  );
});
app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, process.env.SECRET, (err, info) => {
    if (err) {
      console.log(err);
    }
    res.json(info);
  });
});

app.get("/logout", (req, res) => {
  res.clearCookie("token").end();
});

app.listen(process.env.PORT, () => {
  console.log("connected", process.env.PORT);
});
