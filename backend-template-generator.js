#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// Renk kodları
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

// Input validation fonksiyonu
function validateInput(type, input) {
  switch(type) {
    case 'projectName':
      return input && /^[a-zA-Z0-9-_]+$/.test(input);
    case 'database':
      return ['mongodb', 'postgresql', 'mysql', 'none'].includes(input.toLowerCase());
    case 'jwt':
      return ['yes', 'no', 'y', 'n'].includes(input.toLowerCase());
    default:
      return false;
  }
}

class DependencyManager {
  constructor() {
    // Temel bağımlılıklar her zaman yüklenecek
    this.coreDependencies = {
      "express": "^4.18.2",
      "cors": "^2.8.5",
      "dotenv": "^16.3.1",
      "helmet": "^7.1.0"
    };

    // Veritabanı bağımlılıkları
    this.databaseDependencies = {
      "mongodb": { "mongoose": "^8.0.3" },
      "postgresql": { 
        "pg": "^8.11.3", 
        "sequelize": "^6.35.2" 
      },
      "mysql": { 
        "mysql2": "^3.6.5", 
        "sequelize": "^6.35.2" 
      }
    };

    // Opsiyonel bağımlılıklar
    this.optionalDependencies = {
      "jwt": { "jsonwebtoken": "^9.0.2", "bcrypt": "^5.1.1" },
      "logger": { "winston": "^3.11.0" },
      "swagger": { 
        "swagger-jsdoc": "^6.2.8", 
        "swagger-ui-express": "^5.0.0" 
      }
    };

    // Geliştirme bağımlılıkları
    this.devDependencies = {
      "nodemon": "^3.0.2",
      "jest": "^29.7.0",
      "eslint": "^8.56.0",
      "prettier": "^3.1.1"
    };
  }
  createPackageJson(projectName, choices) {
    const { dependencies, devDependencies } = this.updateDependencies(choices);
  
    return {
    "name": projectName,
    "version": "1.0.0",
    "description": "Backend API generated with Backend Template Generator",
    "main": "src/server.js",
    "scripts": {
      "start": "node src/server.js",
      "dev": "nodemon src/server.js",
      "test": "jest"
    },
    "keywords": [],
    "author": "",
    "license": "MIT",
    "dependencies": dependencies,
    "devDependencies": devDependencies
    };
  }
  // Seçimlere göre bağımlılıkları güncelle
  updateDependencies(choices) {
    let dependencies = { ...this.coreDependencies };
    let devDependencies = { ...this.devDependencies };

    // Veritabanı bağımlılıkları
    if (choices.database && this.databaseDependencies[choices.database]) {
      dependencies = {
        ...dependencies,
        ...this.databaseDependencies[choices.database]
      };
    }

    // JWT bağımlılıkları
    if (choices.jwt === 'yes') {
      dependencies = {
        ...dependencies,
        ...this.optionalDependencies.jwt
      };
    }

    // Logger bağımlılıkları
    if (choices.logger === 'yes') {
      dependencies = {
        ...dependencies,
        ...this.optionalDependencies.logger
      };
    }

    // Swagger bağımlılıkları
    if (choices.swagger === 'yes') {
      dependencies = {
        ...dependencies,
        ...this.optionalDependencies.swagger
      };
    }

    return {
      dependencies,
      devDependencies
    };
  }
}

// 1️⃣ CLI Input Validation & User Choices
class CLIManager {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Kullanıcıdan proje adını alır (boş olamaz)
   */
// Proje adı alma
  async getProjectName() {
    while (true) {
      const projectName = await this.askQuestion(`${colors.yellow}Proje adı (çıkış için q):${colors.reset} `);
    
      if (projectName.toLowerCase() === 'q') {
        console.log(`${colors.yellow}İşlem iptal edildi.${colors.reset}`);
        process.exit(0);
      }

      if (validateInput('projectName', projectName)) {
        return projectName;
      }

      console.log(`${colors.red}Hatalı proje adı. Sadece harf, rakam, tire ve alt çizgi kullanabilirsiniz.${colors.reset}`);
    }
  }

  /**
   * Kullanıcıdan veritabanı seçimini alır
   */
  async getDatabaseChoice() {
    const options = [
      { key: '1', value: 'mongodb', label: 'MongoDB' },
      { key: '2', value: 'postgresql', label: 'PostgreSQL' },
      { key: '3', value: 'mysql', label: 'MySQL' },
      { key: '4', value: null, label: 'Hiçbiri' }
    ];

    while (true) {
      console.log(`${colors.yellow}Veritabanı seçin:${colors.reset}`);
      
      options.forEach(option => {
        console.log(`  [${option.key}] ${option.label}`);
      });
      
      const choice = await this.askQuestion(`Seçiminiz (1-4, q: çıkış): `);
      
      if (choice.toLowerCase() === 'q') {
        console.log(`${colors.yellow}İşlem iptal edildi.${colors.reset}`);
        process.exit(0);
      }
      
      const selectedOption = options.find(option => option.key === choice);
      
      if (selectedOption) {
        console.log(`${colors.green}✓ Seçilen veritabanı: ${selectedOption.label || 'Hiçbiri'}${colors.reset}`);
        return selectedOption.value;
      }
      
      console.log(`${colors.red}Hata: Geçersiz seçim. Lütfen 1-4 arasında bir değer girin.${colors.reset}`);
    }
  }

  /**
   * Kullanıcıdan JWT auth kullanmak isteyip istemediğini sorar
   */
  async getAuthChoice() {
    while (true) {
      console.log(`${colors.yellow}JWT Authentication eklensin mi?${colors.reset}`);
      console.log(`  [1] Evet`);
      console.log(`  [2] Hayır`);
      
      const choice = await this.askQuestion(`Seçiminiz (1-2, q: çıkış): `);
      
      if (choice.toLowerCase() === 'q') {
        console.log(`${colors.yellow}İşlem iptal edildi.${colors.reset}`);
        process.exit(0);
      }
      
      if (choice === '1') {
        console.log(`${colors.green}✓ JWT Authentication eklenecek${colors.reset}`);
        return 'jwt';
      } else if (choice === '2') {
        console.log(`${colors.green}✓ JWT Authentication eklenmeyecek${colors.reset}`);
        return null;
      }
      
      console.log(`${colors.red}Hata: Geçersiz seçim. Lütfen 1 veya 2 girin.${colors.reset}`);
    }
  }

  /**
   * Kullanıcıdan logger kullanmak isteyip istemediğini sorar
   */
  async getLoggerChoice() {
    while (true) {
      console.log(`${colors.yellow}Winston logger eklensin mi?${colors.reset}`);
      console.log(`  [1] Evet`);
      console.log(`  [2] Hayır`);
      
      const choice = await this.askQuestion(`Seçiminiz (1-2, q: çıkış): `);
      
      if (choice.toLowerCase() === 'q') {
        console.log(`${colors.yellow}İşlem iptal edildi.${colors.reset}`);
        process.exit(0);
      }
      
      if (choice === '1') {
        console.log(`${colors.green}✓ Winston logger eklenecek${colors.reset}`);
        return true;
      } else if (choice === '2') {
        console.log(`${colors.green}✓ Winston logger eklenmeyecek${colors.reset}`);
        return false;
      }
      
      console.log(`${colors.red}Hata: Geçersiz seçim. Lütfen 1 veya 2 girin.${colors.reset}`);
    }
  }

  /**
   * Kullanıcıdan Swagger dokümantasyonu eklemek isteyip istemediğini sorar
   */
  async getSwaggerChoice() {
    while (true) {
      console.log(`${colors.yellow}OpenAPI/Swagger entegrasyonu eklensin mi?${colors.reset}`);
      console.log(`  [1] Evet`);
      console.log(`  [2] Hayır`);
      
      const choice = await this.askQuestion(`Seçiminiz (1-2, q: çıkış): `);
      
      if (choice.toLowerCase() === 'q') {
        console.log(`${colors.yellow}İşlem iptal edildi.${colors.reset}`);
        process.exit(0);
      }
      
      if (choice === '1') {
        console.log(`${colors.green}✓ OpenAPI/Swagger entegrasyonu eklenecek${colors.reset}`);
        return true;
      } else if (choice === '2') {
        console.log(`${colors.green}✓ OpenAPI/Swagger entegrasyonu eklenmeyecek${colors.reset}`);
        return false;
      }
      
      console.log(`${colors.red}Hata: Geçersiz seçim. Lütfen 1 veya 2 girin.${colors.reset}`);
    }
  }

  /**
   * Kullanıcıdan Docker desteği eklemek isteyip istemediğini sorar
   */
  async getDockerChoice() {
    while (true) {
      console.log(`${colors.yellow}Docker desteği eklensin mi?${colors.reset}`);
      console.log(`  [1] Evet`);
      console.log(`  [2] Hayır`);
      
      const choice = await this.askQuestion(`Seçiminiz (1-2, q: çıkış): `);
      
      if (choice.toLowerCase() === 'q') {
        console.log(`${colors.yellow}İşlem iptal edildi.${colors.reset}`);
        process.exit(0);
      }
      
      if (choice === '1') {
        console.log(`${colors.green}✓ Docker desteği eklenecek${colors.reset}`);
        return true;
      } else if (choice === '2') {
        console.log(`${colors.green}✓ Docker desteği eklenmeyecek${colors.reset}`);
        return false;
      }
      
      console.log(`${colors.red}Hata: Geçersiz seçim. Lütfen 1 veya 2 girin.${colors.reset}`);
    }
  }

  /**
   * Kullanıcıdan CI/CD konfigürasyonu eklemek isteyip istemediğini sorar
   */
  async getCICDChoice() {
    while (true) {
      console.log(`${colors.yellow}GitHub Actions CI/CD konfigürasyonu eklensin mi?${colors.reset}`);
      console.log(`  [1] Evet`);
      console.log(`  [2] Hayır`);
      
      const choice = await this.askQuestion(`Seçiminiz (1-2, q: çıkış): `);
      
      if (choice.toLowerCase() === 'q') {
        console.log(`${colors.yellow}İşlem iptal edildi.${colors.reset}`);
        process.exit(0);
      }
      
      if (choice === '1') {
        console.log(`${colors.green}✓ GitHub Actions CI/CD konfigürasyonu eklenecek${colors.reset}`);
        return true;
      } else if (choice === '2') {
        console.log(`${colors.green}✓ GitHub Actions CI/CD konfigürasyonu eklenmeyecek${colors.reset}`);
        return false;
      }
      
      console.log(`${colors.red}Hata: Geçersiz seçim. Lütfen 1 veya 2 girin.${colors.reset}`);
    }
  }

  /**
   * Soru sorma yardımcı fonksiyonu
   */
  askQuestion(question) {
    return new Promise(resolve => {
      this.rl.question(question, answer => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * Tüm kullanıcı girdilerini al ve konfigürasyon nesnesi döndür
   */
  async collectUserInput() {
    console.log(`${colors.bright}${colors.blue}=================================================`);
    console.log(`        Backend Template Generator V1.1`);
    console.log(`==================================================${colors.reset}`);
    console.log(`Bu araç, tercihlerinize göre özelleştirilmiş bir backend`);
    console.log(`projesi oluşturacaktır. (Çıkmak için 'q' yazın)\n`);
    
    const projectName = await this.getProjectName();
    const currentDir = process.cwd();
    const projectPath = path.join(currentDir, projectName);
    
    console.log('');
    const database = await this.getDatabaseChoice();
    
    console.log('');
    const auth = await this.getAuthChoice();
    
    console.log('');
    const logger = await this.getLoggerChoice();
    
    console.log('');
    const swagger = await this.getSwaggerChoice();
    
    console.log('');
    const docker = await this.getDockerChoice();
    
    console.log('');
    const cicd = await this.getCICDChoice();
    
    console.log('\n');
    console.log(`${colors.cyan}=== Özet ====${colors.reset}`);
    console.log(`Proje Adı: ${projectName}`);
    console.log(`Veritabanı: ${database || 'Hiçbiri'}`);
    console.log(`JWT Authentication: ${auth ? 'Evet' : 'Hayır'}`);
    console.log(`Winston Logger: ${logger ? 'Evet' : 'Hayır'}`);
    console.log(`OpenAPI/Swagger: ${swagger ? 'Evet' : 'Hayır'}`);
    console.log(`Docker Desteği: ${docker ? 'Evet' : 'Hayır'}`);
    console.log(`CI/CD Konfigürasyonu: ${cicd ? 'Evet' : 'Hayır'}`);
    
    console.log('');
    const confirm = await this.askQuestion(`${colors.yellow}Onaylıyor musunuz? (E/H): ${colors.reset}`);
    
    if (confirm.toLowerCase() !== 'e' && confirm.toLowerCase() !== 'evet') {
      console.log(`${colors.yellow}İşlem iptal edildi.${colors.reset}`);
      process.exit(0);
    }
    
    console.log('');
    
    return {
      projectName,
      projectPath,
      config: {
        database,
        auth,
        logger,
        swagger,
        docker,
        cicd
      }
    };
  }
  
  close() {
    this.rl.close();
  }
}

// Main uygulamayı başlat
async function main() {
  const cliManager = new CLIManager();
  const userInput = await cliManager.collectUserInput();
  
  console.log(`${colors.bright}${colors.blue}Proje yapılandırması tamamlandı. Dosya oluşturma aşamasına geçiliyor...${colors.reset}`);
  
  const generator = new ProjectGenerator(userInput.projectName, userInput.projectPath, userInput.config);
  
  // 2. Aşama: Dynamic Dependencies & File Generation
  await generator.generate();

  // 3. Aşama: Docker & CI/CD Entegrasyonu
  const dockerCICDManager = new DockerCICDManager(
    userInput.projectPath, 
    userInput.projectName
  );

  // Docker ve CI/CD kurulumunu yap (config'i choices formatına çevir)
  dockerCICDManager.setupDockerAndCI({
    docker: userInput.config.docker ? 'yes' : 'no',
    cicd: userInput.config.cicd ? 'yes' : 'no',
    database: userInput.config.database
  });
  
  // 4. Aşama: Dynamic README Generation
  const readmeGenerator = new ReadmeGenerator(
    userInput.projectName, 
    {
      database: userInput.config.database,
      jwt: userInput.config.auth === 'jwt' ? 'yes' : 'no',
      logger: userInput.config.logger ? 'yes' : 'no',
      swagger: userInput.config.swagger ? 'yes' : 'no',
      docker: userInput.config.docker ? 'yes' : 'no',
      cicd: userInput.config.cicd ? 'yes' : 'no'
    }
  );

  // README oluştur
  readmeGenerator.writeReadmeFile(userInput.projectPath);

  // Finalize ve başarı mesajı
  await generator.finalize();
  
  cliManager.close();
}

// 2️⃣ Dynamic Dependencies & File Generation
class ProjectGenerator {
  constructor(projectName, projectPath, config) {
    this.projectName = projectName;
    this.projectPath = projectPath;
    this.config = config;
  }

  // Projeyi oluştur
  async generate() {
    console.log(`\n${colors.bright}${colors.blue}Proje oluşturuluyor...${colors.reset}`);

    // Proje dizinini oluştur
    if (fs.existsSync(this.projectPath)) {
      console.log(`${colors.red}Hata: ${this.projectName} dizini zaten mevcut. Lütfen farklı bir isim seçin.${colors.reset}`);
      process.exit(1);
    }

    this.createDirectory(this.projectPath);

    // Temel proje yapısını oluştur
    this.createBasicProjectStructure();

    // package.json oluştur
    this.createPackageJson();

    // Base dosyaları oluştur
    this.createBaseFiles();

    // Config dosyalarını oluştur
    this.createConfigFiles();

    // Middleware dosyalarını oluştur
    this.createMiddlewares();

    // Models oluştur (sadece database seçilmişse)
    if (this.config.database) {
      this.createModels();
    }

    // Controllers ve Routes oluştur
    this.createControllersAndRoutes();

    // Utils dosyalarını oluştur
    this.createUtils();
  }

  // Dizin oluşturma yardımcı fonksiyonu
  createDirectory(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Dosya oluşturma yardımcı fonksiyonu
  createFile(filePath, content) {
    fs.writeFileSync(filePath, content);
  }

  // Temel proje yapısını oluştur (sadece gerekli klasörleri oluştur)
  createBasicProjectStructure() {
    const directories = [
      'src',
      'src/config',
      'src/controllers',
      'src/middleware',
      'src/routes',
      'src/utils'
    ];

    // Database seçilmişse models klasörü oluştur
    if (this.config.database) {
      directories.push('src/models');
    }

    // CI/CD seçilmişse GitHub workflow klasörü oluştur
    if (this.config.cicd) {
      directories.push('.github');
      directories.push('.github/workflows');
    }

    // Logger seçilmişse logs klasörü oluştur
    if (this.config.logger) {
      directories.push('logs');
    }

    for (const dir of directories) {
      this.createDirectory(path.join(this.projectPath, dir));
    }
  }

  // package.json içeriğini oluştur
// package.json oluştur (Sadece seçilen özelliklere göre dinamik bağımlılıklar ekle)
  createPackageJson() {
    const dependencyManager = new DependencyManager();
   
    const choices = {
      database: this.config.database,
      jwt: this.config.auth === 'jwt' ? 'yes' : 'no',
      logger: this.config.logger ? 'yes' : 'no',
      swagger: this.config.swagger ? 'yes' : 'no'
    };
  
    const packageJson = dependencyManager.createPackageJson(this.projectName, choices);
  
    this.createFile(
      path.join(this.projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  // Temel dosyaları oluştur
  createBaseFiles() {
    // .env dosyası
    let envContent = `NODE_ENV=development
PORT=3000
`;

    // Sadece seçilen veritabanına özel çevre değişkenleri
    if (this.config.database === 'mongodb') {
      envContent += `MONGODB_URI=mongodb://localhost:27017/${this.projectName}\n`;
    } else if (this.config.database === 'postgresql') {
      envContent += `DB_HOST=localhost
DB_PORT=5432
DB_NAME=${this.projectName}
DB_USER=postgres
DB_PASSWORD=postgres
`;
    } else if (this.config.database === 'mysql') {
      envContent += `DB_HOST=localhost
DB_PORT=3306
DB_NAME=${this.projectName}
DB_USER=root
DB_PASSWORD=root
`;
    }

    // JWT seçilmişse gerekli çevre değişkenleri
    if (this.config.auth === 'jwt') {
      envContent += 'JWT_SECRET=your_jwt_secret_key\nJWT_EXPIRES_IN=1d\n';
    }

    this.createFile(path.join(this.projectPath, '.env'), envContent);
    this.createFile(path.join(this.projectPath, '.env.example'), envContent);

    // .gitignore
    const gitignoreContent = `node_modules/
.env
dist/
coverage/
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
`;
    this.createFile(path.join(this.projectPath, '.gitignore'), gitignoreContent);

    // server.js
    let serverImports = `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');

`;

    // Sadece seçilen özelliklere göre importlar ekle
    if (this.config.database) {
      serverImports += `const connectDatabase = require('./config/database');\n`;
    }

    if (this.config.logger) {
      serverImports += `const logger = require('./utils/logger');\n`;
    }

    if (this.config.swagger) {
      serverImports += `const swaggerSetup = require('./config/swagger');\n`;
    }

    serverImports += `const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');\n\n`;

    let serverSetup = `// Environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
  res.send('🔥 Backend Template Generator Çalışıyor! 🚀');
});
app.use(express.urlencoded({ extended: true }));\n\n`;

    if (this.config.swagger) {
      serverSetup += `// Swagger Documentation
swaggerSetup(app);\n\n`;
    }

    if (this.config.database) {
      serverSetup += `// Connect to database
connectDatabase();\n\n`;
    }

    let serverRoutes = `// Routes
app.use('/api', routes);\n\n`;

    if (this.config.logger) {
      serverRoutes += `// Logging middleware
app.use((req, res, next) => {
  logger.info(\`\${req.method} \${req.url}\`);
  next();
});\n\n`;
    }

    let serverError = `// Error handling middleware
app.use(errorHandler);\n\n`;

    let serverStart = `// Start server
app.listen(PORT, () => {
  ${this.config.logger ? 'logger.info' : 'console.log'}(\`Server running on port \${PORT}\`);
});\n`;

    const serverContent = serverImports + serverSetup + serverRoutes + serverError + serverStart;
    this.createFile(path.join(this.projectPath, 'src/server.js'), serverContent);
  }

  // Config dosyalarını oluştur
  createConfigFiles() {
    // Database config (sadece seçilmişse)
    if (this.config.database) {
      let dbConfigContent = '';

      if (this.config.database === 'mongodb') {
        dbConfigContent = `const mongoose = require('mongoose');
${this.config.logger ? "const logger = require('../utils/logger');" : ''}

const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    ${this.config.logger ? "logger.info('MongoDB connected successfully');" : "console.log('MongoDB connected successfully');"}
  } catch (error) {
    ${this.config.logger ? "logger.error('MongoDB connection error: ' + error.message);" : "console.error('MongoDB connection error: ' + error.message);"}
    process.exit(1);
  }
};

module.exports = connectDatabase;
`;
      } else if (this.config.database === 'postgresql' || this.config.database === 'mysql') {
        dbConfigContent = `const { Sequelize } = require('sequelize');
${this.config.logger ? "const logger = require('../utils/logger');" : ''}

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: '${this.config.database === 'postgresql' ? 'postgres' : 'mysql'}',
    logging: ${this.config.logger ? 'msg => logger.debug(msg)' : 'false'}
  }
);

const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    ${this.config.logger ? "logger.info('Database connected successfully');" : "console.log('Database connected successfully');"}
  } catch (error) {
    ${this.config.logger ? "logger.error('Database connection error: ' + error.message);" : "console.error('Database connection error: ' + error.message);"}
    process.exit(1);
  }
};
module.exports = connectDatabase;
module.exports.sequelize = sequelize;
`;
      }

      this.createFile(path.join(this.projectPath, 'src/config/database.js'), dbConfigContent);
    }

    // Swagger config (sadece seçilmişse)
    if (this.config.swagger) {
      const swaggerConfigContent = `const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '${this.projectName} API',
      version: '1.0.0',
      description: 'API Documentation for ${this.projectName}',
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Local server',
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/models/*.js'],
};

const specs = swaggerJsdoc(options);

const swaggerSetup = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
};

module.exports = swaggerSetup;
`;

      this.createFile(path.join(this.projectPath, 'src/config/swagger.js'), swaggerConfigContent);
    }

    // JWT config (sadece seçilmişse)
    if (this.config.auth === 'jwt') {
      const jwtConfigContent = `const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { valid: true, expired: false, decoded };
  } catch (error) {
    return {
      valid: false,
      expired: error.name === 'TokenExpiredError',
      decoded: null
    };
  }
};

module.exports = {
  generateToken,
  verifyToken
};
`;

      this.createFile(path.join(this.projectPath, 'src/config/jwt.js'), jwtConfigContent);
    }
  }

  // Middleware dosyalarını oluştur
  createMiddlewares() {
    // Error Handler
    const errorHandlerContent = `${this.config.logger ? "const logger = require('../utils/logger');" : ''}

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  ${this.config.logger ? "logger.error(err.message);" : "console.error(err.message);"}
  
  res.status(statusCode).json({
    success: false,
    error: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};

module.exports = errorHandler;
`;

    this.createFile(path.join(this.projectPath, 'src/middleware/errorHandler.js'), errorHandlerContent);

    // Auth Middleware (JWT) - sadece seçilmişse
    if (this.config.auth === 'jwt') {
      const authMiddlewareContent = `const { verifyToken } = require('../config/jwt');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token is required' });
  }

  const token = authHeader.split(' ')[1];
  const { valid, expired, decoded } = verifyToken(token);

  if (!valid) {
    return res.status(401).json({ 
      message: expired ? 'Token has expired' : 'Invalid token' 
    });
  }

  req.user = decoded;
  next();
};

module.exports = authenticate;
`;

      this.createFile(path.join(this.projectPath, 'src/middleware/auth.js'), authMiddlewareContent);
    }
  }

  // Model dosyalarını oluştur (sadece veritabanı seçilmişse)
  createModels() {
    if (this.config.database === 'mongodb') {
      // Kullanıcı modeli (MongoDB)
      const userModelContent = `const mongoose = require('mongoose');
${this.config.auth === 'jwt' ? "const bcrypt = require('bcrypt');" : ''}

/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         id:
 *           type: string
 *           description: Auto-generated ID
 *         name:
 *           type: string
 *           description: User's name
 *         email:
 *           type: string
 *           description: User's email
 *         password:
 *           type: string
 *           description: User's password (hashed)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
  },
  {
    timestamps: true,
  }
);

${this.config.auth === 'jwt' ? `
// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};
` : ''}

const User = mongoose.model('User', userSchema);

module.exports = User;
`;

      this.createFile(path.join(this.projectPath, 'src/models/User.js'), userModelContent);

    } else if (this.config.database === 'postgresql' || this.config.database === 'mysql') {
      // Kullanıcı modeli (SQL)
      const userModelContent = `const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
${this.config.auth === 'jwt' ? "const bcrypt = require('bcrypt');" : ''}

/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated ID
 *         name:
 *           type: string
 *           description: User's name
 *         email:
 *           type: string
 *           description: User's email
 *         password:
 *           type: string
 *           description: User's password (hashed)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 */
const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

${this.config.auth === 'jwt' ? `
// Hook to hash password before saving
User.beforeCreate(async (user) => {
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
});

User.beforeUpdate(async (user) => {
  if (user.changed('password')) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

// Instance method to compare password
User.prototype.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};
` : ''}

module.exports = User;
`;

      this.createFile(path.join(this.projectPath, 'src/models/User.js'), userModelContent);
    }
  }

  // Controller ve Route dosyalarını oluştur
  createControllersAndRoutes() {
    // Ana route dosyası
    const mainRouteContent = `const express = require('express');
const router = express.Router();

const healthRoutes = require('./health');
${this.config.auth === 'jwt' ? "const authRoutes = require('./auth');" : ''}
${this.config.database ? "const userRoutes = require('./users');" : ''}

// Health check route
router.use('/health', healthRoutes);

${this.config.auth === 'jwt' ? '// Auth routes\nrouter.use(\'/auth\', authRoutes);\n' : ''}
${this.config.database ? '// User routes\nrouter.use(\'/users\', userRoutes);\n' : ''}

module.exports = router;
`;

    this.createFile(path.join(this.projectPath, 'src/routes/index.js'), mainRouteContent);

    // Health check route ve controller (her zaman oluştur)
    const healthControllerContent = `const getHealth = (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running',
    time: new Date().toISOString()
  });
};

module.exports = {
  getHealth
};
`;

    this.createFile(path.join(this.projectPath, 'src/controllers/healthController.js'), healthControllerContent);

    const healthRouteContent = `const express = require('express');
const router = express.Router();
const { getHealth } = require('../controllers/healthController');

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Check API health
 *     description: Returns the current status of the API
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: API is running
 *                 time:
 *                   type: string
 *                   format: date-time
 */
router.get('/', getHealth);

module.exports = router;
`;

    this.createFile(path.join(this.projectPath, 'src/routes/health.js'), healthRouteContent);

    // Database seçildiyse User controller ve route oluştur
    if (this.config.database) {
      // User controller
      let userControllerContent = '';

      if (this.config.database === 'mongodb') {
        userControllerContent = `const User = require('../models/User');

/**
 * @desc    Get all users
 * @route   GET /api/users
 * @access  ${this.config.auth === 'jwt' ? 'Private' : 'Public'}
 */
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password');
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @access  ${this.config.auth === 'jwt' ? 'Private' : 'Public'}
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById
};
`;
      } else if (this.config.database === 'postgresql' || this.config.database === 'mysql') {
        userControllerContent = `const User = require('../models/User');

/**
 * @desc    Get all users
 * @route   GET /api/users
 * @access  ${this.config.auth === 'jwt' ? 'Private' : 'Public'}
 */
const getUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] }
    });
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @access  ${this.config.auth === 'jwt' ? 'Private' : 'Public'}
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById
};
`;
      }

      this.createFile(path.join(this.projectPath, 'src/controllers/userController.js'), userControllerContent);

      // User routes
      const userRouteContent = `const express = require('express');
const router = express.Router();
const { getUsers, getUserById } = require('../controllers/userController');
${this.config.auth === 'jwt' ? "const authenticate = require('../middleware/auth');" : ''}

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Get all users
 *     description: Retrieve a list of all users
 *     ${this.config.auth === 'jwt' ? "security:\n *       - bearerAuth: []" : ''}
 *     responses:
 *       200:
 *         description: A list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 */
router.get('/', ${this.config.auth === 'jwt' ? 'authenticate, ' : ''}getUsers);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve a single user by their ID
 *     ${this.config.auth === 'jwt' ? "security:\n *       - bearerAuth: []" : ''}
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 */
router.get('/:id', ${this.config.auth === 'jwt' ? 'authenticate, ' : ''}getUserById);

module.exports = router;
`;

      this.createFile(path.join(this.projectPath, 'src/routes/users.js'), userRouteContent);
    }

    // Auth controller & routes (JWT) - sadece seçilmişse
    if (this.config.auth === 'jwt' && this.config.database) {
      const authControllerContent = `const User = require('../models/User');
const { generateToken } = require('../config/jwt');

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    ${this.config.database === 'mongodb'
      ? `const userExists = await User.findOne({ email });`
      : `const userExists = await User.findOne({ where: { email } });`}
    
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password
    });

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      token,
      data: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    ${this.config.database === 'mongodb'
      ? `const user = await User.findOne({ email });`
      : `const user = await User.findOne({ where: { email } });`}
    
if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(user);

    res.status(200).json({
      success: true,
      token,
      data: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    ${this.config.database === 'mongodb'
      ? `const user = await User.findById(req.user.id).select('-password');`
      : `const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });`}
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe
};
`;

      this.createFile(path.join(this.projectPath, 'src/controllers/authController.js'), authControllerContent);

      const authRouteContent = `const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const authenticate = require('../middleware/auth');

/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *       400:
 *         description: User already exists
 */
router.post('/register', register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login
 *     description: Login with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 *       404:
 *         description: User not found
 */
router.post('/login', login);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get user profile
 *     description: Retrieve the current user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authorized
 */
router.get('/me', authenticate, getMe);

module.exports = router;
`;

      this.createFile(path.join(this.projectPath, 'src/routes/auth.js'), authRouteContent);
    } else if (this.config.auth === 'jwt' && !this.config.database) {
      // Database seçilmemişse basitleştirilmiş auth route ve controller
      const authControllerContent = `const jwt = require('jsonwebtoken');

// Mock users for demo purposes (only when no database is selected)
const users = [
  {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    password: '$2b$10$4tJU4tXn5Yf5h4LKk7l5uOAUpBZRlUJ1jg1LXZLknXOL0M3nTnR6y' // "password123"
  }
];

/**
 * @desc    Login user (demo)
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Simple login for demo
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // For demo, accept any password for the test user
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    res.status(200).json({
      success: true,
      token,
      data: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get demo user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    const user = users.find(u => u.id === req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Remove password
    const { password, ...userData } = user;
    
    res.status(200).json({
      success: true,
      data: userData
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  getMe
};
`;

      this.createFile(path.join(this.projectPath, 'src/controllers/authController.js'), authControllerContent);

      const authRouteContent = `const express = require('express');
const router = express.Router();
const { login, getMe } = require('../controllers/authController');
const authenticate = require('../middleware/auth');

/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login (Demo)
 *     description: Login with test credentials
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: test@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', login);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get user profile (Demo)
 *     description: Retrieve the current user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *       401:
 *         description: Not authorized
 */
router.get('/me', authenticate, getMe);

module.exports = router;
`;

      this.createFile(path.join(this.projectPath, 'src/routes/auth.js'), authRouteContent);
    }
  }

  // Utils dosyalarını oluştur (seçildiğinde)
  createUtils() {
    // Logger - sadece seçildiyse
    if (this.config.logger) {
      const loggerContent = `const winston = require('winston');
const path = require('path');

// Log formatı
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return \`\${timestamp} \${level}: \${message}\`;
});

// Logger yapılandırması
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    logFormat
  ),
  transports: [
    // Konsola log
    new winston.transports.Console(),
    
    // Dosyaya log
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
    }),
  ],
});

module.exports = logger;
`;

      this.createFile(path.join(this.projectPath, 'src/utils/logger.js'), loggerContent);
    }

    // Validation yardımcı fonksiyonları (her zaman oluştur)
    const validationContent = `/**
 * Email validator
 * @param {string} email 
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Password validator (min 6 chars, at least one number and one letter)
 * @param {string} password 
 * @returns {boolean}
 */
const isValidPassword = (password) => {
  if (password.length < 6) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasLetter && hasNumber;
};

module.exports = {
  isValidEmail,
  isValidPassword
};
`;

    this.createFile(path.join(this.projectPath, 'src/utils/validation.js'), validationContent);
  }
  async finalize() {
    try {
      process.chdir(this.projectPath);
      execSync('npm install', { stdio: 'ignore' });
      console.log(`${colors.green}✓ npm paketleri başarıyla yüklendi.${colors.reset}`);
    } catch (error) {
      console.log(`${colors.yellow}Uyarı: npm paketleri yüklenemedi. Manuel olarak 'npm install' komutunu çalıştırın.${colors.reset}`);
    }
  }
}
// ---------------------------------------------------------
  // 3️⃣ Docker & CI/CD Entegrasyonu
  // ---------------------------------------------------------

  // Docker dosyalarını oluştur (sadece seçilmişse)
class DockerCICDManager {
    constructor(projectPath, projectName) {
      this.projectPath = projectPath;
      this.projectName = projectName;
    }
  
    // Docker ve CI/CD kurulumunu yönet
    setupDockerAndCI(choices) {
      // Docker seçilirse Dockerfile oluştur
      if (choices.docker === 'yes') {
        this.createDockerfile(choices);
        this.createDockerIgnore();
        
        // Eğer veritabanı seçilmişse docker-compose oluştur
        if (choices.database && choices.database !== 'none') {
          this.createDockerCompose(choices.database);
        }
      }
  
      // CI/CD seçilirse GitHub Actions workflow dosyası oluştur
      if (choices.cicd === 'yes') {
        this.createGitHubWorkflows(choices);
      }
    }
  
    // Dockerfile oluşturma
    createDockerfile(choices) {
      let dockerfileContent = `FROM node:18-alpine
  
  WORKDIR /app
  
  COPY package*.json ./
  
  RUN npm ci --only=production
  
  COPY . .
  
  ENV NODE_ENV=production
  
  EXPOSE 3000
  
  CMD ["node", "src/server.js"]`;
  
      fs.writeFileSync(
        path.join(this.projectPath, 'Dockerfile'), 
        dockerfileContent
      );
    }
  
    // .dockerignore dosyası oluşturma
    createDockerIgnore() {
      const dockerIgnoreContent = `node_modules
  npm-debug.log
  .git
  .gitignore
  .env
  .DS_Store
  coverage
  logs
  `;
  
      fs.writeFileSync(
        path.join(this.projectPath, '.dockerignore'), 
        dockerIgnoreContent
      );
    }
  
    // Docker Compose oluşturma (veritabanına göre)
    createDockerCompose(database) {
      let dockerComposeContent = `version: '3'
  
  services:
    app:
      build: .
      ports:
        - '3000:3000'
      environment:
        - NODE_ENV=production`;
  
      // eslint-disable-next-line default-case
      switch(database) {
        case 'mongodb':
          dockerComposeContent += `
        - MONGODB_URI=mongodb://mongo:27017/${this.projectName}
      depends_on:
        - mongo
      restart: unless-stopped
  
    mongo:
      image: mongo:6
      ports:
        - '27017:27017'
      volumes:
        - mongo_data:/data/db
      restart: unless-stopped
  
  volumes:
    mongo_data:`;
          break;
        
        case 'postgresql':
          dockerComposeContent += `
        - DB_HOST=postgres
        - DB_PORT=5432
        - DB_USER=postgres
        - DB_PASSWORD=postgres
        - DB_NAME=${this.projectName}
      depends_on:
        - postgres
      restart: unless-stopped
  
    postgres:
      image: postgres:16-alpine
      ports:
        - '5432:5432'
      environment:
        - POSTGRES_USER=postgres
        - POSTGRES_PASSWORD=postgres
        - POSTGRES_DB=${this.projectName}
      volumes:
        - postgres_data:/var/lib/postgresql/data
      restart: unless-stopped
  
  volumes:
    postgres_data:`;
          break;
        
        case 'mysql':
          dockerComposeContent += `
        - DB_HOST=mysql
        - DB_PORT=3306
        - DB_USER=root
        - DB_PASSWORD=root
        - DB_NAME=${this.projectName}
      depends_on:
        - mysql
      restart: unless-stopped
  
    mysql:
      image: mysql:8
      ports:
        - '3306:3306'
      environment:
        - MYSQL_ROOT_PASSWORD=root
        - MYSQL_DATABASE=${this.projectName}
      volumes:
        - mysql_data:/var/lib/mysql
      restart: unless-stopped
  
  volumes:
    mysql_data:`;
          break;
      default:
            // Veritabanı seçilmedi durumu
            console.log(`${colors.yellow}Veritabanı seçilmeden Docker Compose yapılandırması oluşturuluyor.${colors.reset}`);
            break;
      }
  
      fs.writeFileSync(
        path.join(this.projectPath, 'docker-compose.yml'), 
        dockerComposeContent
      );
    }
  
    // GitHub Actions workflow dosyaları oluşturma
    createGitHubWorkflows(choices) {
      // CI workflow
      const ciWorkflowContent = `name: CI
  
  on:
    push:
      branches: [ main, master ]
    pull_request:
      branches: [ main, master ]
  
  jobs:
    test:
      runs-on: ubuntu-latest
  
      strategy:
        matrix:
          node-version: [16.x, 18.x]
  
      steps:
      - uses: actions/checkout@v3
      
      - name: Use Node.js \${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.node-version }}
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run linter
        run: npm run lint
        
      - name: Run tests
        run: npm test
  `;
  
      // GitHub workflow klasörünü oluştur
      const workflowDir = path.join(this.projectPath, '.github', 'workflows');
      fs.mkdirSync(workflowDir, { recursive: true });
  
      // CI workflow dosyasını yaz
      fs.writeFileSync(
        path.join(workflowDir, 'ci.yml'), 
        ciWorkflowContent
      );
  
      // Docker ile CD workflow (Docker seçilmişse)
      if (choices.docker === 'yes') {
        const cdWorkflowContent = `name: CD
  
  on:
    push:
      branches: [ main, master ]
      tags: [ 'v*' ]
  
  jobs:
    build-and-push:
      runs-on: ubuntu-latest
      
      steps:
      - uses: actions/checkout@v3
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: \${{ secrets.DOCKERHUB_USERNAME }}
          password: \${{ secrets.DOCKERHUB_TOKEN }}
          
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: \${{ github.event_name != 'pull_request' }}
          tags: \${{ secrets.DOCKERHUB_USERNAME }}/${this.projectName}:latest
  `;
  
        fs.writeFileSync(
          path.join(workflowDir, 'cd.yml'), 
          cdWorkflowContent
        );
      }
    }
  }
  // ---------------------------------------------------------
  // 4️⃣ Dynamic README Generation
  // ---------------------------------------------------------

  // Seçimlere göre dinamik README oluştur
class ReadmeGenerator {
    constructor(projectName, choices) {
      this.projectName = projectName;
      this.choices = choices;
    }
  
    generateReadme() {
      let readmeContent = `# ${this.projectName}
  
  ## Proje Genel Bakış
  
  Bu proje Backend Template Generator V1.1 kullanılarak otomatik olarak oluşturulmuştur.
  
  ## Özellikler\n`;
  
      // Seçilen özellikleri ekle
      readmeContent += this.addFeatures();
  
      // Kurulum ve çalıştırma talimatları
      readmeContent += this.addInstallationInstructions();
  
      // Veritabanı kurulumu (eğer seçildiyse)
      if (this.choices.database && this.choices.database !== 'none') {
        readmeContent += this.addDatabaseSetup();
      }
  
      // JWT Authentication (eğer seçildiyse)
      if (this.choices.jwt === 'yes') {
        readmeContent += this.addAuthenticationSetup();
      }
  
      // Docker kurulumu (eğer seçildiyse)
      if (this.choices.docker === 'yes') {
        readmeContent += this.addDockerInstructions();
      }
  
      // CI/CD kurulumu (eğer seçildiyse)
      if (this.choices.cicd === 'yes') {
        readmeContent += this.addCICDInstructions();
      }
  
      // Proje yapısı
      readmeContent += this.addProjectStructure();
  
      // Lisans
      readmeContent += `\n## Lisans
  
  MIT License`;
  
      return readmeContent;
    }
  
    addFeatures() {
      let features = '';
      
      if (this.choices.database && this.choices.database !== 'none') {
        features += `- ${this.choices.database.toUpperCase()} Veritabanı Entegrasyonu\n`;
      }
      
      if (this.choices.jwt === 'yes') {
        features += `- JWT Authentication\n`;
      }
      
      if (this.choices.logger === 'yes') {
        features += `- Winston Logger\n`;
      }
      
      if (this.choices.swagger === 'yes') {
        features += `- Swagger API Dokümantasyonu\n`;
      }
      
      if (this.choices.docker === 'yes') {
        features += `- Docker Desteği\n`;
      }
      
      if (this.choices.cicd === 'yes') {
        features += `- GitHub Actions CI/CD\n`;
      }
  
      return features ? `\n## Özellikler\n\n${features}\n` : '';
    }
  
    addInstallationInstructions() {
      return `
  ## Kurulum ve Çalıştırma
  
  1. Bağımlılıkları yükleyin:
  \`\`\`bash
  npm install
  \`\`\`
  
  2. Geliştirme sunucusunu başlatın:
  \`\`\`bash
  npm run dev
  \`\`\`
  
  3. Üretim sunucusunu başlatın:
  \`\`\`bash
  npm start
  \`\`\`
  `;
    }
  
    addDatabaseSetup() {
      switch(this.choices.database) {
        case 'mongodb':
          return `
  ## Veritabanı Kurulumu (MongoDB)
  
  1. MongoDB'yi yerel makinenize kurun veya bulut servisi kullanın.
  
  2. Bağlantı URL'sini \`.env\` dosyasında güncelleyin:
  \`\`\`
  MONGODB_URI=mongodb://localhost:27017/${this.projectName}
  \`\`\`
  `;
        case 'postgresql':
          return `
  ## Veritabanı Kurulumu (PostgreSQL)
  
  1. PostgreSQL'i yerel makinenize kurun.
  
  2. Veritabanı bağlantı bilgilerini \`.env\` dosyasında güncelleyin:
  \`\`\`
  DB_HOST=localhost
  DB_PORT=5432
  DB_NAME=${this.projectName}
  DB_USER=postgres
  DB_PASSWORD=postgres
  \`\`\`
  `;
        case 'mysql':
          return `
  ## Veritabanı Kurulumu (MySQL)
  
  1. MySQL'i yerel makinenize kurun.
  
  2. Veritabanı bağlantı bilgilerini \`.env\` dosyasında güncelleyin:
  \`\`\`
  DB_HOST=localhost
  DB_PORT=3306
  DB_NAME=${this.projectName}
  DB_USER=root
  DB_PASSWORD=root
  \`\`\`
  `;
        default:
          return '';
      }
    }
  
    addAuthenticationSetup() {
      return `
  ## Authentication Kurulumu
  
  1. JWT secret key oluşturun ve \`.env\` dosyasına ekleyin:
  \`\`\`
  JWT_SECRET=your_secure_secret_key
  JWT_EXPIRES_IN=1d
  \`\`\`
  
  2. Temel authentication endpointleri:
  - \`POST /auth/register\`: Yeni kullanıcı kaydı
  - \`POST /auth/login\`: Kullanıcı girişi
  - \`GET /auth/me\`: Kullanıcı profili
  `;
    }
  
    addDockerInstructions() {
      return `
  ## Docker Kurulumu
  
  1. Docker imajını oluşturun:
  \`\`\`bash
  docker build -t ${this.projectName} .
  \`\`\`
  
  2. Docker konteynerini çalıştırın:
  \`\`\`bash
  docker run -p 3000:3000 ${this.projectName}
  \`\`\`
  
  3. Docker Compose ile çalıştırma:
  \`\`\`bash
  docker-compose up -d
  \`\`\`
  `;
    }
  
    addCICDInstructions() {
      return `
  ## CI/CD Kurulumu
  
  Proje GitHub Actions ile otomatik test ve dağıtım içerir.
  
  - Her push ve pull request için otomatik testler çalışır
  - Main branch'e push yapıldığında CI/CD workflow'ları tetiklenir
  `;
    }
  
    addProjectStructure() {
      return `
  ## Proje Yapısı
  
  \`\`\`
  ${this.projectName}/
  ├── src/
  │   ├── config/
  │   ├── controllers/
  │   ├── middleware/
  │   ├── models/
  │   ├── routes/
  │   └── utils/
  ├── .env
  ├── package.json
  └── README.md
  \`\`\`
  `;
    }
  
    // README dosyasını oluştur
    writeReadmeFile(projectPath) {
      const readmeContent = this.generateReadme();
      
      fs.writeFileSync(
        path.join(projectPath, 'README.md'), 
        readmeContent
      );
    }

  // npm paketlerini yükle ve başarı mesajı göster
  async finalize() {
    // npm init
    try {
      process.chdir(this.projectPath);
      execSync('npm install', { stdio: 'ignore' });
      console.log(`${colors.green}✓ npm paketleri başarıyla yüklendi.${colors.reset}`);
    } catch (error) {
      console.log(`${colors.yellow}Uyarı: npm paketleri yüklenemedi. Manuel olarak 'npm install' komutunu çalıştırın.${colors.reset}`);
    }

    this.showSuccessMessage();
  }

  // Başarı mesajı göster
  showSuccessMessage() {
    console.log(`\n${colors.bright}${colors.green}Proje başarıyla oluşturuldu!${colors.reset}`);
    console.log(`\nProjeyi çalıştırmak için:`);
    console.log(`  cd ${this.projectName}`);
    console.log(`  npm run dev`);
    console.log(`\nProje http://localhost:3000/api adresinde çalışacaktır.`);
    
    if (this.config.swagger) {
      console.log(`\nAPI Dokümantasyonu: http://localhost:3000/api-docs`);
    }
    
    if (this.config.docker) {
      console.log(`\nDocker ile çalıştırmak için:`);
      console.log(`  docker-compose up -d`);
    }
  }
  }


  main().catch(err => {
    console.error(`${colors.red}Hata: ${err.message}${colors.reset}`);
    process.exit(1);
  });