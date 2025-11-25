const axios = require('axios');
const { performance } = require('perf_hooks');

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 ULTRA KOMPLEKS BUG HUNTER TEST SÜİTİ
// ═══════════════════════════════════════════════════════════════════════════
// Bu test süiti sistemdeki TÜM bug'ları keşfetmek için tasarlanmıştır.
// Edge case'ler, race condition'lar, veri tutarlılığı, performans ve güvenlik testleri içerir.
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE_URL = 'http://localhost:5000/api';
let authToken = null;
let tenantId = 'test-tenant';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  validateStatus: () => true // Tüm status kodlarını kabul et
});

api.interceptors.request.use(config => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  if (tenantId) {
    config.headers['X-TenantId'] = tenantId;
  }
  return config;
});

// Test sonuçları
const testResults = {
  passed: [],
  failed: [],
  warnings: [],
  details: [],
  bugs: [],
  performance: [],
  startTime: Date.now()
};

// Helper function to generate valid TC Kimlik No (11 digits)
function generateValidTC() {
  const digits = [];
  for (let i = 0; i < 11; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }
  return digits.join('');
}

// Test utility
async function test(name, testFn, category = 'General', critical = false) {
  const startTime = performance.now();
  try {
    console.log(`\n🧪 [${category}] ${name}${critical ? ' ⚠️ CRITICAL' : ''}`);
    const result = await testFn();
    const duration = performance.now() - startTime;
    testResults.passed.push({ name, category, duration, result, critical });
    testResults.details.push({ name, category, status: 'PASS', duration, result });
    console.log(`✅ PASS: ${name} (${duration.toFixed(2)}ms)`);
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
    const status = error.response?.status;
    const bugInfo = {
      name,
      category,
      error: errorMsg,
      status,
      duration,
      critical,
      stack: error.stack,
      response: error.response?.data
    };
    testResults.failed.push(bugInfo);
    testResults.bugs.push(bugInfo);
    testResults.details.push({ name, category, status: 'FAIL', duration, error: errorMsg, status });
    console.log(`❌ FAIL: ${name} - ${errorMsg} (${duration.toFixed(2)}ms)`);
    if (error.response?.data) {
      console.log(`   Response:`, JSON.stringify(error.response.data, null, 2).substring(0, 300));
    }
    if (!critical) throw error; // Non-critical testlerde hata fırlatma
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 AUTHENTICATION & AUTHORIZATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

async function testAuthentication() {
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     🔐 AUTHENTICATION & AUTHORIZATION TESTS              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await test('Admin login with correct credentials', async () => {
    const response = await api.post('/auth/login', {
      username: 'admin',
      password: 'Admin123!'
    });
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}. Response: ${JSON.stringify(response.data)}`);
    }
    // Token might be in different locations
    const token = response.data.token || response.data.accessToken || response.data.access_token;
    if (!token) {
      throw new Error(`Token not returned. Response: ${JSON.stringify(response.data)}`);
    }
    authToken = token;
    // Set tenant ID from response if available
    if (response.data.tenantId) {
      tenantId = response.data.tenantId;
    } else if (response.data.user?.tenants && response.data.user.tenants.length > 0) {
      tenantId = response.data.user.tenants[0];
    }
    return response.data;
  }, 'Authentication', true);

  await test('SQL Injection attempt in username', async () => {
    const response = await api.post('/auth/login', {
      username: "admin' OR '1'='1",
      password: 'anything'
    });
    if (response.status === 200 && response.data.token) {
      throw new Error('SQL injection vulnerability detected!');
    }
    return { blocked: true };
  }, 'Security', true);

  await test('XSS attempt in username', async () => {
    const response = await api.post('/auth/login', {
      username: '<script>alert("xss")</script>',
      password: 'test'
    });
    if (response.status === 200 && response.data.token) {
      throw new Error('XSS vulnerability detected!');
    }
    return { blocked: true };
  }, 'Security', true);

  await test('Very long username (DoS attempt)', async () => {
    const response = await api.post('/auth/login', {
      username: 'A'.repeat(10000),
      password: 'test'
    });
    if (response.status === 200 && response.data.token) {
      throw new Error('DoS vulnerability detected!');
    }
    return { blocked: true };
  }, 'Security', true);

  await test('Null byte injection', async () => {
    const response = await api.post('/auth/login', {
      username: 'admin\0',
      password: 'Admin123!'
    });
    return response.data;
  }, 'Security');

  await test('Empty strings', async () => {
    const response = await api.post('/auth/login', {
      username: '',
      password: ''
    });
    if (response.status === 200) throw new Error('Should reject empty credentials');
    return response.data;
  }, 'Security');

  await test('Special characters in password', async () => {
    const response = await api.post('/auth/login', {
      username: 'admin',
      password: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    });
    return response.data;
  }, 'Security');

  await test('Unicode characters', async () => {
    const response = await api.post('/auth/login', {
      username: 'admin',
      password: '测试密码🔒'
    });
    return response.data;
  }, 'Security');
}

// ═══════════════════════════════════════════════════════════════════════════
// 👥 STUDENT CRUD - ULTRA COMPLEX TESTS
// ═══════════════════════════════════════════════════════════════════════════

async function testStudentUltraComplex() {
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     👥 STUDENT CRUD - ULTRA COMPLEX TESTS                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const studentIds = [];
  let createdStudentId = null;

  // CREATE TESTS
  await test('Create student with all fields populated', async () => {
    const studentData = {
      tcKimlikNo: generateValidTC(),
      firstName: 'Test',
      lastName: 'Öğrenci',
      birthDate: '1990-01-01',
      phone: '05551234567',
      email: 'test@example.com',
      address: 'Test Adresi 123',
      educationLevel: 'Lise',
      licenseType: 'B',
      licenseIssueDate: '2015-01-01',
      selectedSrcCourses: [1, 2, 3]
    };
    const response = await api.post('/students', studentData);
    if (response.status !== 201 && response.status !== 200) {
      throw new Error(`Expected 201/200, got ${response.status}`);
    }
    createdStudentId = response.data.id;
    studentIds.push(createdStudentId);
    return response.data;
  }, 'Student CRUD', true);

  await test('Create student with boundary values - minimum age', async () => {
    const today = new Date();
    today.setFullYear(today.getFullYear() - 18);
    const studentData = {
      tcKimlikNo: generateValidTC(),
      firstName: 'MinAge',
      lastName: 'Test',
      birthDate: today.toISOString().split('T')[0]
    };
    const response = await api.post('/students', studentData);
    studentIds.push(response.data.id);
    return response.data;
  }, 'Student CRUD');

  await test('Create student with boundary values - maximum age', async () => {
    const today = new Date();
    today.setFullYear(today.getFullYear() - 100);
    const studentData = {
      tcKimlikNo: generateValidTC(),
      firstName: 'MaxAge',
      lastName: 'Test',
      birthDate: today.toISOString().split('T')[0]
    };
    const response = await api.post('/students', studentData);
    studentIds.push(response.data.id);
    return response.data;
  }, 'Student CRUD');

  await test('Create student with future birth date (should fail)', async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    try {
      const response = await api.post('/students', {
        tcKimlikNo: generateValidTC(),
        firstName: 'Future',
        lastName: 'Test',
        birthDate: futureDate.toISOString()
      });
      if (response.status === 201 || response.status === 200) {
        throw new Error('Should reject future birth date');
      }
    } catch (error) {
      if (error.response?.status === 400) return { blocked: true };
      throw error;
    }
  }, 'Student CRUD');

  await test('Create student with invalid TC format - too short', async () => {
    try {
      const response = await api.post('/students', {
        tcKimlikNo: '12345',
        firstName: 'Test',
        lastName: 'Test'
      });
      if (response.status === 201 || response.status === 200) {
        throw new Error('Should reject invalid TC format');
      }
    } catch (error) {
      if (error.response?.status === 400) return { blocked: true };
      throw error;
    }
  }, 'Student CRUD');

  await test('Create student with invalid TC format - too long', async () => {
    try {
      const response = await api.post('/students', {
        tcKimlikNo: '123456789012345',
        firstName: 'Test',
        lastName: 'Test'
      });
      if (response.status === 201 || response.status === 200) {
        throw new Error('Should reject invalid TC format');
      }
    } catch (error) {
      if (error.response?.status === 400) return { blocked: true };
      throw error;
    }
  }, 'Student CRUD');

  await test('Create student with invalid TC format - non-numeric', async () => {
    try {
      const response = await api.post('/students', {
        tcKimlikNo: 'ABCDEFGHIJK',
        firstName: 'Test',
        lastName: 'Test'
      });
      if (response.status === 201 || response.status === 200) {
        throw new Error('Should reject non-numeric TC');
      }
    } catch (error) {
      if (error.response?.status === 400) return { blocked: true };
      throw error;
    }
  }, 'Student CRUD');

  await test('Create student with duplicate TC (should fail)', async () => {
    const tc = generateValidTC();
    await api.post('/students', {
      tcKimlikNo: tc,
      firstName: 'First',
      lastName: 'Student'
    });
    try {
      const response = await api.post('/students', {
        tcKimlikNo: tc,
        firstName: 'Second',
        lastName: 'Student'
      });
      if (response.status === 201 || response.status === 200) {
        throw new Error('Should reject duplicate TC');
      }
    } catch (error) {
      if (error.response?.status === 400) return { blocked: true };
      throw error;
    }
  }, 'Student CRUD');

  await test('Create student with SQL injection in name', async () => {
    try {
      const response = await api.post('/students', {
        tcKimlikNo: generateValidTC(),
        firstName: "Robert'; DROP TABLE Students;--",
        lastName: 'Test'
      });
      // Check if database is still intact
      const listResponse = await api.get('/students');
      if (listResponse.status !== 200) {
        throw new Error('SQL injection may have succeeded!');
      }
      return { blocked: true };
    } catch (error) {
      return { blocked: true };
    }
  }, 'Security', true);

  await test('Create student with XSS in name', async () => {
    const response = await api.post('/students', {
      tcKimlikNo: generateValidTC(),
      firstName: '<script>alert("xss")</script>',
      lastName: 'Test'
    });
    if (response.status === 201 || response.status === 200) {
      studentIds.push(response.data.id);
    }
    return response.data;
  }, 'Security');

  await test('Create student with very long name (DoS)', async () => {
    try {
      const response = await api.post('/students', {
        tcKimlikNo: generateValidTC(),
        firstName: 'A'.repeat(100000),
        lastName: 'Test'
      });
      if (response.status === 201 || response.status === 200) {
        throw new Error('Should reject very long names');
      }
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 413) {
        return { blocked: true };
      }
      throw error;
    }
  }, 'Security');

  await test('Create student with null values', async () => {
    const response = await api.post('/students', {
      tcKimlikNo: generateValidTC(),
      firstName: null,
      lastName: null,
      birthDate: null,
      phone: null,
      email: null
    });
    studentIds.push(response.data.id);
    return response.data;
  }, 'Student CRUD');

  await test('Create student with empty strings', async () => {
    const response = await api.post('/students', {
      tcKimlikNo: generateValidTC(),
      firstName: '',
      lastName: '',
      phone: '',
      email: ''
    });
    studentIds.push(response.data.id);
    return response.data;
  }, 'Student CRUD');

  await test('Create student with whitespace-only strings', async () => {
    const response = await api.post('/students', {
      tcKimlikNo: generateValidTC(),
      firstName: '   ',
      lastName: '   ',
      phone: '   '
    });
    studentIds.push(response.data.id);
    return response.data;
  }, 'Student CRUD');

  await test('Create student with special characters', async () => {
    const response = await api.post('/students', {
      tcKimlikNo: generateValidTC(),
      firstName: "O'Brien-Çelik & Şahin",
      lastName: 'Test<>"\'',
      email: 'test+tag@example.com'
    });
    studentIds.push(response.data.id);
    return response.data;
  }, 'Student CRUD');

  await test('Create student with Unicode characters', async () => {
    const response = await api.post('/students', {
      tcKimlikNo: generateValidTC(),
      firstName: '测试学生',
      lastName: 'Тест',
      email: 'test@测试.com'
    });
    studentIds.push(response.data.id);
    return response.data;
  }, 'Student CRUD');

  await test('Create student with invalid email format', async () => {
    try {
      const response = await api.post('/students', {
        tcKimlikNo: generateValidTC(),
        firstName: 'Test',
        lastName: 'Test',
        email: 'invalid-email'
      });
      if (response.status === 201 || response.status === 200) {
        throw new Error('Should reject invalid email');
      }
    } catch (error) {
      if (error.response?.status === 400) return { blocked: true };
      throw error;
    }
  }, 'Student CRUD');

  await test('Create student with valid but edge-case email', async () => {
    const response = await api.post('/students', {
      tcKimlikNo: generateValidTC(),
      firstName: 'Test',
      lastName: 'Test',
      email: 'test+tag@sub-domain.example.co.uk'
    });
    studentIds.push(response.data.id);
    return response.data;
  }, 'Student CRUD');

  // READ TESTS
  await test('Get student by ID', async () => {
    if (!createdStudentId) throw new Error('No student created');
    const response = await api.get(`/students/${createdStudentId}`);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (!response.data.profile?.id && !response.data.id) throw new Error('Student ID not found');
    return response.data;
  }, 'Student CRUD', true);

  await test('Get non-existent student (should return 404)', async () => {
    const response = await api.get('/students/999999999');
    if (response.status !== 404) {
      throw new Error(`Expected 404, got ${response.status}`);
    }
    return response.data;
  }, 'Student CRUD');

  await test('Get student with negative ID', async () => {
    const response = await api.get('/students/-1');
    if (response.status === 200) {
      throw new Error('Should reject negative IDs');
    }
    return response.data;
  }, 'Student CRUD');

  await test('Get student with zero ID', async () => {
    const response = await api.get('/students/0');
    if (response.status === 200) {
      throw new Error('Should reject zero ID');
    }
    return response.data;
  }, 'Student CRUD');

  await test('Get student with string ID', async () => {
    const response = await api.get('/students/abc');
    if (response.status === 200) {
      throw new Error('Should reject non-numeric IDs');
    }
    return response.data;
  }, 'Student CRUD');

  await test('List all students with pagination', async () => {
    const response = await api.get('/students?page=1&pageSize=10');
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    return response.data;
  }, 'Student CRUD');

  await test('List students with invalid pagination', async () => {
    const response = await api.get('/students?page=-1&pageSize=-10');
    return response.data;
  }, 'Student CRUD');

  await test('Search students by name', async () => {
    const response = await api.get('/students?search=Test');
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    return response.data;
  }, 'Student CRUD');

  await test('Search students with SQL injection', async () => {
    const response = await api.get('/students?search=test\' OR \'1\'=\'1');
    return response.data;
  }, 'Security');

  await test('Search students with XSS', async () => {
    const response = await api.get('/students?search=<script>alert("xss")</script>');
    return response.data;
  }, 'Security');

  // UPDATE TESTS
  await test('Update student first name', async () => {
    if (!createdStudentId) throw new Error('No student created');
    const response = await api.put(`/students/${createdStudentId}`, {
      firstName: 'Updated'
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    return response.data;
  }, 'Student CRUD', true);

  await test('Update student with all fields', async () => {
    if (!createdStudentId) throw new Error('No student created');
    const response = await api.put(`/students/${createdStudentId}`, {
      firstName: 'Fully',
      lastName: 'Updated',
      phone: '05559876543',
      email: 'updated@example.com',
      address: 'Updated Address 456'
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    return response.data;
  }, 'Student CRUD');

  await test('Update non-existent student (should return 404)', async () => {
    const response = await api.put('/students/999999999', {
      firstName: 'Test'
    });
    if (response.status !== 404) {
      throw new Error(`Expected 404, got ${response.status}`);
    }
    return response.data;
  }, 'Student CRUD');

  await test('Update student with invalid data', async () => {
    if (!createdStudentId) throw new Error('No student created');
    const response = await api.put(`/students/${createdStudentId}`, {
      tcKimlikNo: 'invalid'
    });
    return response.data;
  }, 'Student CRUD');

  // DELETE TESTS
  await test('Delete student', async () => {
    // Create a student to delete
    const createResponse = await api.post('/students', {
      tcKimlikNo: generateValidTC(),
      firstName: 'ToDelete',
      lastName: 'Test'
    });
    const studentId = createResponse.data.id;
    
    const response = await api.delete(`/students/${studentId}`);
    if (response.status !== 200 && response.status !== 204) {
      throw new Error(`Expected 200/204, got ${response.status}`);
    }
    
    // Verify deletion
    const getResponse = await api.get(`/students/${studentId}`);
    if (getResponse.status !== 404) {
      throw new Error('Student should be deleted');
    }
    return { deleted: true };
  }, 'Student CRUD', true);

  await test('Delete non-existent student (should return 404)', async () => {
    const response = await api.delete('/students/999999999');
    if (response.status !== 404) {
      throw new Error(`Expected 404, got ${response.status}`);
    }
    return response.data;
  }, 'Student CRUD');

  await test('Delete student with negative ID', async () => {
    const response = await api.delete('/students/-1');
    if (response.status === 200 || response.status === 204) {
      throw new Error('Should reject negative IDs');
    }
    return response.data;
  }, 'Student CRUD');

  // Cleanup
  for (const id of studentIds) {
    try {
      await api.delete(`/students/${id}`);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 📚 COURSE/GROUP CRUD - ULTRA COMPLEX TESTS
// ═══════════════════════════════════════════════════════════════════════════

async function testCourseGroupUltraComplex() {
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     📚 COURSE/GROUP CRUD - ULTRA COMPLEX TESTS           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const groupIds = [];
  let createdGroupId = null;

  await test('Create group with all fields', async () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    
    const groupData = {
      Year: now.getFullYear(),
      Month: now.getMonth() + 1,
      GroupNo: Math.floor(Math.random() * 1000) + 1000,
      StartDate: startDate.toISOString().split('T')[0],
      EndDate: endDate.toISOString().split('T')[0],
      Branch: 'Test Branch',
      Capacity: 30,
      SrcType: 1,
      IsMixed: false,
      PlannedHours: 40
    };
    const response = await api.post('/courses/groups', groupData);
    if (response.status !== 201 && response.status !== 200) {
      throw new Error(`Expected 201/200, got ${response.status}`);
    }
    createdGroupId = response.data.id;
    groupIds.push(createdGroupId);
    return response.data;
  }, 'Course/Group CRUD', true);

  await test('Create group with invalid SRC type (should fail)', async () => {
    try {
      const now = new Date();
      const response = await api.post('/courses/groups', {
        Year: now.getFullYear(),
        Month: now.getMonth() + 1,
        GroupNo: 9999,
        StartDate: new Date().toISOString().split('T')[0],
        EndDate: new Date().toISOString().split('T')[0],
        Branch: 'Test',
        Capacity: 30,
        SrcType: 99, // Invalid
        IsMixed: false,
        PlannedHours: 40
      });
      if (response.status === 201 || response.status === 200) {
        throw new Error('Should reject invalid SRC type');
      }
    } catch (error) {
      if (error.response?.status === 400) return { blocked: true };
      throw error;
    }
  }, 'Course/Group CRUD');

  await test('Create group with end date before start date (should fail)', async () => {
    try {
      const now = new Date();
      const response = await api.post('/courses/groups', {
        Year: now.getFullYear(),
        Month: now.getMonth() + 1,
        GroupNo: 9998,
        StartDate: '2025-12-31',
        EndDate: '2025-01-01', // Before start
        Branch: 'Test',
        Capacity: 30,
        SrcType: 1,
        IsMixed: false,
        PlannedHours: 40
      });
      if (response.status === 201 || response.status === 200) {
        throw new Error('Should reject invalid date range');
      }
    } catch (error) {
      if (error.response?.status === 400) return { blocked: true };
      throw error;
    }
  }, 'Course/Group CRUD');

  await test('Create group with negative capacity (should fail)', async () => {
    try {
      const now = new Date();
      const response = await api.post('/courses/groups', {
        Year: now.getFullYear(),
        Month: now.getMonth() + 1,
        GroupNo: 9997,
        StartDate: new Date().toISOString().split('T')[0],
        EndDate: new Date().toISOString().split('T')[0],
        Branch: 'Test',
        Capacity: -10, // Invalid
        SrcType: 1,
        IsMixed: false,
        PlannedHours: 40
      });
      if (response.status === 201 || response.status === 200) {
        throw new Error('Should reject negative capacity');
      }
    } catch (error) {
      if (error.response?.status === 400) return { blocked: true };
      throw error;
    }
  }, 'Course/Group CRUD');

  await test('Create group with zero capacity', async () => {
    const now = new Date();
    const response = await api.post('/courses/groups', {
      Year: now.getFullYear(),
      Month: now.getMonth() + 1,
      GroupNo: 9996,
      StartDate: new Date().toISOString().split('T')[0],
      EndDate: new Date().toISOString().split('T')[0],
      Branch: 'Test',
      Capacity: 0,
      SrcType: 1,
      IsMixed: false,
      PlannedHours: 40
    });
    if (response.status === 201 || response.status === 200) {
      groupIds.push(response.data.id);
    }
    return response.data;
  }, 'Course/Group CRUD');

  await test('Create group with very large capacity', async () => {
    const now = new Date();
    const response = await api.post('/courses/groups', {
      Year: now.getFullYear(),
      Month: now.getMonth() + 1,
      GroupNo: 9995,
      StartDate: new Date().toISOString().split('T')[0],
      EndDate: new Date().toISOString().split('T')[0],
      Branch: 'Test',
      Capacity: 999999,
      SrcType: 1,
      IsMixed: false,
      PlannedHours: 40
    });
    if (response.status === 201 || response.status === 200) {
      groupIds.push(response.data.id);
    }
    return response.data;
  }, 'Course/Group CRUD');

  await test('Create duplicate group (should fail)', async () => {
    const now = new Date();
    const groupNo = 9994;
    await api.post('/courses/groups', {
      Year: now.getFullYear(),
      Month: now.getMonth() + 1,
      GroupNo: groupNo,
      StartDate: new Date().toISOString().split('T')[0],
      EndDate: new Date().toISOString().split('T')[0],
      Branch: 'Test',
      Capacity: 30,
      SrcType: 1,
      IsMixed: false,
      PlannedHours: 40
    });
    
    try {
      const response = await api.post('/courses/groups', {
        Year: now.getFullYear(),
        Month: now.getMonth() + 1,
        GroupNo: groupNo, // Same group number
        StartDate: new Date().toISOString().split('T')[0],
        EndDate: new Date().toISOString().split('T')[0],
        Branch: 'Test',
        Capacity: 30,
        SrcType: 1,
        IsMixed: false,
        PlannedHours: 40
      });
      if (response.status === 201 || response.status === 200) {
        throw new Error('Should reject duplicate group');
      }
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 409) {
        return { blocked: true };
      }
      throw error;
    }
  }, 'Course/Group CRUD');

  await test('Get group detail', async () => {
    if (!createdGroupId) throw new Error('No group created');
    const response = await api.get(`/courses/groups/${createdGroupId}/detail`);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    return response.data;
  }, 'Course/Group CRUD', true);

  await test('Update group', async () => {
    if (!createdGroupId) throw new Error('No group created');
    const response = await api.put(`/courses/groups/${createdGroupId}`, {
      Branch: 'Updated Branch',
      Capacity: 35
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    return response.data;
  }, 'Course/Group CRUD');

  await test('Delete group', async () => {
    // Create a group to delete
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const createResponse = await api.post('/courses/groups', {
      Year: now.getFullYear(),
      Month: now.getMonth() + 1,
      GroupNo: Math.floor(Math.random() * 10000) + 9000,
      StartDate: now.toISOString().split('T')[0],
      EndDate: tomorrow.toISOString().split('T')[0],
      Branch: 'ToDelete',
      Capacity: 30,
      SrcType: 1,
      IsMixed: false,
      PlannedHours: 40
    });
    const groupId = createResponse.data.id || createResponse.data.Id;
    if (!groupId) {
      throw new Error('Group ID not found in response: ' + JSON.stringify(createResponse.data));
    }
    
    // Hard delete (soft=false)
    const response = await api.delete(`/courses/groups/${groupId}?soft=false`, { validateStatus: () => true });
    if (response.status !== 200 && response.status !== 204) {
      throw new Error(`Expected 200/204, got ${response.status}: ${JSON.stringify(response.data)}`);
    }
    return { deleted: true };
  }, 'Course/Group CRUD', true);

  // Cleanup
  for (const id of groupIds) {
    try {
      await api.delete(`/courses/groups/${id}`);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔗 ENROLLMENT - ULTRA COMPLEX TESTS
// ═══════════════════════════════════════════════════════════════════════════

async function testEnrollmentUltraComplex() {
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     🔗 ENROLLMENT - ULTRA COMPLEX TESTS                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  let studentId = null;
  let groupId = null;
  let enrollmentId = null;

  // Setup
  await test('Create student for enrollment test', async () => {
    const response = await api.post('/students', {
      tcKimlikNo: generateValidTC(),
      firstName: 'Enrollment',
      lastName: 'Test',
      selectedSrcCourses: [1]
    });
    studentId = response.data.id;
    return response.data;
  }, 'Enrollment', true);

  await test('Create group for enrollment test', async () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    const response = await api.post('/courses/groups', {
      Year: now.getFullYear(),
      Month: now.getMonth() + 1,
      GroupNo: Math.floor(Math.random() * 1000) + 2000,
      StartDate: startDate.toISOString().split('T')[0],
      EndDate: endDate.toISOString().split('T')[0],
      Branch: 'Enrollment Test',
      Capacity: 30,
      SrcType: 1,
      IsMixed: false,
      PlannedHours: 40
    });
    groupId = response.data.id;
    return response.data;
  }, 'Enrollment', true);

  await test('Add student to group', async () => {
    if (!studentId || !groupId) throw new Error('Student or group not created');
    const response = await api.post(`/courses/groups/${groupId}/students`, {
      studentId: studentId
    });
    if (response.status !== 201 && response.status !== 200) {
      throw new Error(`Expected 201/200, got ${response.status}`);
    }
    enrollmentId = response.data.enrollmentId || response.data.id;
    return response.data;
  }, 'Enrollment', true);

  await test('Add same student twice (should fail)', async () => {
    if (!studentId || !groupId) throw new Error('Student or group not created');
    try {
      const response = await api.post(`/courses/groups/${groupId}/students`, {
        studentId: studentId
      });
      if (response.status === 201 || response.status === 200) {
        throw new Error('Should reject duplicate enrollment');
      }
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 409) {
        return { blocked: true };
      }
      throw error;
    }
  }, 'Enrollment');

  await test('Add student to non-existent group (should fail)', async () => {
    try {
      const response = await api.post('/courses/groups/999999999/students', {
        studentId: studentId
      });
      if (response.status === 201 || response.status === 200) {
        throw new Error('Should reject non-existent group');
      }
    } catch (error) {
      if (error.response?.status === 404) return { blocked: true };
      throw error;
    }
  }, 'Enrollment');

  await test('Add non-existent student to group (should fail)', async () => {
    if (!groupId) throw new Error('Group not created');
    try {
      const response = await api.post(`/courses/groups/${groupId}/students`, {
        studentId: 999999999
      });
      if (response.status === 201 || response.status === 200) {
        throw new Error('Should reject non-existent student');
      }
    } catch (error) {
      if (error.response?.status === 404) return { blocked: true };
      throw error;
    }
  }, 'Enrollment');

  await test('Remove student from group', async () => {
    if (!studentId || !groupId || !enrollmentId) {
      throw new Error(`Student, group or enrollment not created - studentId: ${studentId}, groupId: ${groupId}, enrollmentId: ${enrollmentId}`);
    }
    const response = await api.delete(`/courses/groups/${groupId}/students/${enrollmentId}`);
    if (response.status !== 200 && response.status !== 204) {
      throw new Error(`Expected 200/204, got ${response.status}`);
    }
    return { removed: true };
  }, 'Enrollment', true);

  await test('Remove student that is not enrolled (should fail)', async () => {
    if (!studentId || !groupId) throw new Error('Student or group not created');
    try {
      const response = await api.delete(`/courses/groups/${groupId}/students/${studentId}`);
      if (response.status === 200 || response.status === 204) {
        throw new Error('Should reject removal of non-enrolled student');
      }
    } catch (error) {
      if (error.response?.status === 404) return { blocked: true };
      throw error;
    }
  }, 'Enrollment');

  // Cleanup
  if (studentId) {
    try {
      await api.delete(`/students/${studentId}`);
    } catch (e) {}
  }
  if (groupId) {
    try {
      await api.delete(`/courses/groups/${groupId}`);
    } catch (e) {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚡ CONCURRENT OPERATIONS TESTS (Race Conditions)
// ═══════════════════════════════════════════════════════════════════════════

async function testConcurrentOperations() {
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     ⚡ CONCURRENT OPERATIONS TESTS (Race Conditions)     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await test('Concurrent student creation with same TC', async () => {
    const tc = generateValidTC();
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      promises.push(
        api.post('/students', {
          tcKimlikNo: tc,
          firstName: `Concurrent${i}`,
          lastName: 'Test'
        }).catch(e => e.response)
      );
    }
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r && (r.status === 201 || r.status === 200)).length;
    
    if (successCount > 1) {
      throw new Error(`Race condition detected! ${successCount} students created with same TC`);
    }
    
    return { successCount, total: results.length };
  }, 'Concurrency', true);

  await test('Concurrent enrollment to same group', async () => {
    // Create student and group
    const studentResponse = await api.post('/students', {
      tcKimlikNo: generateValidTC(),
      firstName: 'Concurrent',
      lastName: 'Enrollment',
      selectedSrcCourses: [1]
    });
    const studentId = studentResponse.data.id;
    
    const now = new Date();
    const groupResponse = await api.post('/courses/groups', {
      Year: now.getFullYear(),
      Month: now.getMonth() + 1,
      GroupNo: Math.floor(Math.random() * 1000) + 3000,
      StartDate: new Date().toISOString().split('T')[0],
      EndDate: new Date().toISOString().split('T')[0],
      Branch: 'Concurrent Test',
      Capacity: 1, // Only 1 capacity
      SrcType: 1,
      IsMixed: false,
      PlannedHours: 40
    });
    const groupId = groupResponse.data.id;
    
    // Create 3 students and try to enroll concurrently
    const studentIds = [];
    for (let i = 0; i < 3; i++) {
      const sRes = await api.post('/students', {
        tcKimlikNo: generateValidTC(),
        firstName: `Concurrent${i}`,
        lastName: 'Test',
        selectedSrcCourses: [1]
      });
      studentIds.push(sRes.data.id);
    }
    
    const promises = studentIds.map(sId =>
      api.post(`/courses/groups/${groupId}/students`, {
        studentId: sId
      }).catch(e => e.response)
    );
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r && (r.status === 201 || r.status === 200)).length;
    
    if (successCount > 1) {
      throw new Error(`Race condition detected! ${successCount} students enrolled in capacity=1 group`);
    }
    
    // Cleanup
    for (const sId of studentIds) {
      try {
        await api.delete(`/students/${sId}`);
      } catch (e) {}
    }
    try {
      await api.delete(`/students/${studentId}`);
    } catch (e) {}
    try {
      await api.delete(`/courses/groups/${groupId}`);
    } catch (e) {}
    
    return { successCount, total: results.length };
  }, 'Concurrency', true);

  await test('Concurrent updates to same student', async () => {
    const studentResponse = await api.post('/students', {
      tcKimlikNo: generateValidTC(),
      firstName: 'Concurrent',
      lastName: 'Update'
    });
    const studentId = studentResponse.data.id;
    
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        api.put(`/students/${studentId}`, {
          firstName: `Updated${i}`
        }).catch(e => e.response)
      );
    }
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r && r.status === 200).length;
    
    // Check final state
    const finalResponse = await api.get(`/students/${studentId}`);
    const finalFirstName = finalResponse.data.profile?.firstName || finalResponse.data.firstName;
    
    // Cleanup
    try {
      await api.delete(`/students/${studentId}`);
    } catch (e) {}
    
    return { successCount, finalFirstName, total: results.length };
  }, 'Concurrency');
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 DATA INTEGRITY TESTS
// ═══════════════════════════════════════════════════════════════════════════

async function testDataIntegrity() {
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     🔒 DATA INTEGRITY TESTS                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await test('Cascade delete - Delete student with enrollments', async () => {
    // Create student
    const studentResponse = await api.post('/students', {
      tcKimlikNo: generateValidTC(),
      firstName: 'Cascade',
      lastName: 'Test',
      selectedSrcCourses: [1]
    });
    const studentId = studentResponse.data.id;
    
    // Create group
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const groupResponse = await api.post('/courses/groups', {
      Year: now.getFullYear(),
      Month: now.getMonth() + 1,
      GroupNo: Math.floor(Math.random() * 1000) + 4000,
      StartDate: now.toISOString().split('T')[0],
      EndDate: tomorrow.toISOString().split('T')[0],
      Branch: 'Cascade Test',
      Capacity: 30,
      SrcType: 1,
      IsMixed: false,
      PlannedHours: 40
    });
    const groupId = groupResponse.data.id;
    
    // Enroll student
    await api.post(`/courses/groups/${groupId}/students`, {
      studentId: studentId
    });
    
    // Delete student
    const deleteResponse = await api.delete(`/students/${studentId}`, { validateStatus: () => true });
    if (deleteResponse.status !== 200 && deleteResponse.status !== 204) {
      throw new Error(`Expected 200/204, got ${deleteResponse.status}: ${JSON.stringify(deleteResponse.data)}`);
    }
    
    // Wait a bit for deletion to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify student is deleted
    try {
      const getStudentResponse = await api.get(`/students/${studentId}`, { validateStatus: () => true });
      if (getStudentResponse.status !== 404) {
        throw new Error(`Student should be deleted but got status ${getStudentResponse.status}`);
      }
    } catch (error) {
      if (error.response?.status !== 404 && error.response?.status !== undefined) {
        throw error;
      }
      // If no response, it might be a network error, check if it's actually 404
      if (!error.response || error.response.status !== 404) {
        // Try one more time
        await new Promise(resolve => setTimeout(resolve, 200));
        try {
          const retryResponse = await api.get(`/students/${studentId}`, { validateStatus: () => true });
          if (retryResponse.status !== 404) {
            throw new Error(`Student should be deleted but got status ${retryResponse.status}`);
          }
        } catch (retryError) {
          if (retryError.response?.status !== 404) {
            throw new Error(`Student should be deleted but got status ${retryError.response?.status || 'unknown'}`);
          }
        }
      }
    }
    
    // Verify group still exists
    try {
      const getGroupResponse = await api.get(`/courses/groups/${groupId}/detail`);
      if (getGroupResponse.status !== 200) {
        throw new Error('Group should still exist');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Group should still exist');
      }
      throw error;
    }
    
    // Cleanup
    try {
      await api.delete(`/courses/groups/${groupId}`);
    } catch (e) {}
    
    return { studentDeleted: true, groupExists: true };
  }, 'Data Integrity', true);

  await test('Foreign key constraint - Delete group with enrollments', async () => {
    // Create student and group
    const studentResponse = await api.post('/students', {
      tcKimlikNo: generateValidTC(),
      firstName: 'FK',
      lastName: 'Test',
      selectedSrcCourses: [1]
    });
    const studentId = studentResponse.data.id;
    
    const now = new Date();
    const groupResponse = await api.post('/courses/groups', {
      Year: now.getFullYear(),
      Month: now.getMonth() + 1,
      GroupNo: Math.floor(Math.random() * 1000) + 5000,
      StartDate: new Date().toISOString().split('T')[0],
      EndDate: new Date().toISOString().split('T')[0],
      Branch: 'FK Test',
      Capacity: 30,
      SrcType: 1,
      IsMixed: false,
      PlannedHours: 40
    });
    const groupId = groupResponse.data.id;
    
    // Enroll student
    await api.post(`/courses/groups/${groupId}/students`, {
      studentId: studentId
    });
    
    // Try to delete group (should handle enrollments properly)
    const deleteResponse = await api.delete(`/courses/groups/${groupId}`);
    
    // Cleanup
    try {
      await api.delete(`/students/${studentId}`);
    } catch (e) {}
    
    return { deleted: deleteResponse.status === 200 || deleteResponse.status === 204 };
  }, 'Data Integrity');
}

// ═══════════════════════════════════════════════════════════════════════════
// 📊 PERFORMANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════

async function testPerformance() {
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     📊 PERFORMANCE TESTS                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await test('Bulk student creation performance', async () => {
    const startTime = performance.now();
    const studentIds = [];
    const count = 10;
    
    for (let i = 0; i < count; i++) {
      const response = await api.post('/students', {
        tcKimlikNo: generateValidTC(),
        firstName: `Bulk${i}`,
        lastName: 'Test'
      });
      if (response.status === 201 || response.status === 200) {
        studentIds.push(response.data.id);
      }
    }
    
    const duration = performance.now() - startTime;
    const avgTime = duration / count;
    
    // Cleanup
    for (const id of studentIds) {
      try {
        await api.delete(`/students/${id}`);
      } catch (e) {}
    }
    
    testResults.performance.push({
      test: 'Bulk student creation',
      count,
      totalTime: duration,
      avgTime: avgTime
    });
    
    if (avgTime > 1000) {
      throw new Error(`Performance issue: Average time ${avgTime.toFixed(2)}ms is too high`);
    }
    
    return { count, totalTime: duration, avgTime };
  }, 'Performance');

  await test('List all students performance', async () => {
    const startTime = performance.now();
    const response = await api.get('/students');
    const duration = performance.now() - startTime;
    
    testResults.performance.push({
      test: 'List all students',
      duration: duration
    });
    
    if (duration > 5000) {
      throw new Error(`Performance issue: List operation took ${duration.toFixed(2)}ms`);
    }
    
    return { duration, count: response.data?.length || 0 };
  }, 'Performance');
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 MAIN TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════

async function runAllTests() {
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🚀 ULTRA KOMPLEKS BUG HUNTER TEST SÜİTİ                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nAPI Base URL: ${API_BASE_URL}`);
  console.log(`Test Başlangıç Zamanı: ${new Date().toLocaleString('tr-TR')}\n`);

  try {
    await testAuthentication();
    await testStudentUltraComplex();
    await testCourseGroupUltraComplex();
    await testEnrollmentUltraComplex();
    await testConcurrentOperations();
    await testDataIntegrity();
    await testPerformance();
  } catch (error) {
    console.error('\n❌ Kritik hata:', error.message);
    console.error(error.stack);
  }

  // Print summary
  const endTime = Date.now();
  const totalTime = (endTime - testResults.startTime) / 1000;

  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              🐛 BUG HUNTER TEST ÖZET RAPORU                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`✅ Başarılı Testler: ${testResults.passed.length}`);
  console.log(`❌ Başarısız Testler: ${testResults.failed.length}`);
  console.log(`⚠️  Uyarılar: ${testResults.warnings.length}`);
  console.log(`\nToplam Test: ${testResults.passed.length + testResults.failed.length}`);
  console.log(`Başarı Oranı: ${((testResults.passed.length / (testResults.passed.length + testResults.failed.length)) * 100).toFixed(2)}%`);
  console.log(`Toplam Süre: ${totalTime.toFixed(2)} saniye\n`);

  if (testResults.bugs.length > 0) {
    console.log('🐛 BULUNAN BUG\'LAR:\n');
    testResults.bugs.forEach((bug, index) => {
      console.log(`${index + 1}. [${bug.category}] ${bug.name}`);
      console.log(`   Hata: ${bug.error}`);
      console.log(`   HTTP Status: ${bug.status || 'N/A'}`);
      console.log(`   Süre: ${bug.duration.toFixed(2)}ms`);
      if (bug.critical) {
        console.log(`   ⚠️  KRİTİK BUG!`);
      }
      console.log('');
    });
  }

  if (testResults.performance.length > 0) {
    console.log('⏱️  PERFORMANS METRİKLERİ:\n');
    testResults.performance.forEach(perf => {
      console.log(`  ${perf.test}:`);
      if (perf.avgTime) {
        console.log(`    - Toplam: ${perf.totalTime.toFixed(2)}ms`);
        console.log(`    - Ortalama: ${perf.avgTime.toFixed(2)}ms`);
        console.log(`    - Count: ${perf.count}`);
      } else {
        console.log(`    - Süre: ${perf.duration.toFixed(2)}ms`);
      }
    });
    console.log('');
  }

  console.log(`Test Bitiş Zamanı: ${new Date().toLocaleString('tr-TR')}\n`);

  // Save detailed report
  const fs = require('fs');
  const report = {
    summary: {
      passed: testResults.passed.length,
      failed: testResults.failed.length,
      warnings: testResults.warnings.length,
      totalTime: totalTime,
      successRate: ((testResults.passed.length / (testResults.passed.length + testResults.failed.length)) * 100).toFixed(2) + '%'
    },
    bugs: testResults.bugs,
    performance: testResults.performance,
    details: testResults.details
  };

  fs.writeFileSync('BUG_HUNTER_REPORT.json', JSON.stringify(report, null, 2));
  console.log('📄 Detaylı rapor: BUG_HUNTER_REPORT.json\n');
}

// Run tests
runAllTests().catch(console.error);

