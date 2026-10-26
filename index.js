const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const connectDB = require('./app/config/db');
connectDB();
const responseHandler = require('./app/middleware/responseHandler');
const errorHandler = require('./app/middleware/errorHandlerMiddleware');

//Routes Imports
const authRoutes = require('./app/router/authRoutes');
const profileRoutes = require('./app/router/profileRouter');
//const webshellRoute = require('./src/routes/webShellRoutes/webshellRoutes');

//module scaffolding
const app = express();

//security and middleware
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cors());
app.use(responseHandler);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/', (req, res) => {
  res.success(200, 'Hey There', 'Welcome to Career Orbit Api');
});

//Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);
//app.use('/api/v1/webshell', webshellRoute);

// Routes handler
app.use((req, res, next) => {
  const error = new Error(`Can't find ${req.originalUrl} on this server`);
  error.statusCode = 404;
  next(error);
});

//Error Handler
app.use(errorHandler);

//server run
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
