import fetch from 'node-fetch';

async function testAPI() {
  try {
    console.log('🔍 Testing API endpoints...');
    
    // Test health endpoint
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:4000/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    
    // Test KPI endpoint
    console.log('\n2. Testing KPI endpoint...');
    const kpiResponse = await fetch('http://localhost:4000/cubejs-api/v1/load');
    const kpiData = await kpiResponse.json();
    console.log('✅ KPI data:', JSON.stringify(kpiData, null, 2));
    
    // Test trends endpoint
    console.log('\n3. Testing trends endpoint...');
    const trendsResponse = await fetch('http://localhost:4000/cubejs-api/v1/trends');
    const trendsData = await trendsResponse.json();
    console.log('✅ Trends data (first 3 records):');
    console.log(JSON.stringify(trendsData.data.slice(0, 3), null, 2));
    
    // Test risk distribution endpoint
    console.log('\n4. Testing risk distribution endpoint...');
    const riskResponse = await fetch('http://localhost:4000/cubejs-api/v1/risk-distribution');
    const riskData = await riskResponse.json();
    console.log('✅ Risk distribution data:', riskData);
    
    // Test product performance endpoint
    console.log('\n5. Testing product performance endpoint...');
    const productResponse = await fetch('http://localhost:4000/cubejs-api/v1/product-performance');
    const productData = await productResponse.json();
    console.log('✅ Product performance data:', productData);
    
    console.log('\n🎉 All API endpoints are working!');
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

testAPI();
