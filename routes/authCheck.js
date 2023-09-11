const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
const { verifyJWT } = require("../Modules/verifyJWT");

const { mongoClient, employeeCollection, usersCollection, userAccountCollection } = require('../index');


// Login route
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(username, password); 


    const user = await usersCollection.findOne({ username });


    if (!user) {
      const employee = await employeeCollection.findOne({ username });

      if (!employee) {
        return res.status(401).json({  success: false, message: "Invalid credentials" });
      }


      if (!employee.password) {
        return res.status(401).json({ success: false, message: "Password not found for employee" });
      }


      const isPasswordMatch = await bcrypt.compare(password, employee.password);

      if (isPasswordMatch) {
        const token = jwt.sign(
          { username: employee.username },
          process.env.WEB_TOKEN_SECRET,
          {
            expiresIn: "1d",
          }
        );

        return res.status(200).json({
          success: true,
          message: "Login successful",
          result: employee,
          isAdmin: true,
          token: token,
        });
      } else {
        return res.status(401).json({
          success: false,
          message: "Passwords do not match",
        });
      }
    } else {

      if (!user.password) {
        return res.status(401).json({ error: true, message: "Password not found for user" });
      }


      const isPasswordMatch = await bcrypt.compare(password, user.password);

      if (isPasswordMatch) {
        const token = jwt.sign({ username: user.username }, process.env.WEB_TOKEN_SECRET, {
          expiresIn: "1d",
        });

        return res.status(200).json({
          success: true,
          message: "Login successful",
          result: user,
          token: token,
          isAdmin: false,
        });
      } else {
        return res.status(401).json({
          success: false,
          message: "Passwords do not match",
        });
      }
    }
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: error.message,
    });
  }
});




// Profile route (protected with JWT authentication)
router.get("/user/profile", verifyJWT, async (req, res) => {
  try {
    const username = req.decoded.username;

    const user = await usersCollection.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: true, message: "User not found" });
    }

    res.status(200).json({ success: true, result: user });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// password change 
router.post('/change-password', verifyJWT, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await usersCollection.findOne({ username: req.decoded.username });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);


    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Incorrect old password' });
    }
    const isOldPassword = await bcrypt.compare(newPassword, user.password);


    if (isOldPassword) {
      return res.status(401).json({ success: false, message: 'Your old password and new password are same, Please try another one' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await usersCollection.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });

    res.status(200).json({ success: true, message: 'Password changed' });
  } catch (error) {
    console.error('Error in /change-password:', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred while changing the password.',
    });
  }
});


// account number to email getting api 
router.get('/account-to-email', async (req, res) => {
  try {
    const { accountNumber } = req.query;

    // Assuming userAccountCollection is a MongoDB collection, use findOne to find a user by accountNumber
    const user = await userAccountCollection.findOne({ accountNumber });

    if (user) {
      const email = user.email;
      return res.status(200).json({ success: true, message: "Email find successfully" });
    } else {
      return res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'An error occurred' });
  }
});



router.get('/auth-check', async (req, res) => {
  const email = req.query.email;
  // console.log(email);

  try {
    const firstCheck = await usersCollection.find({ email: email }).toArray();

    if (firstCheck.length > 0) {
      const secondCheck = await employeeCollection.findOne({ primaryEmail: email });

      if (secondCheck) {
        const designation = secondCheck.designation;
        res.send(designation);
      } else {
        res.status(404).send("Employee not found");
      }
    } else {
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
