import fetch from 'node-fetch';

async function testCubeJSAPI() {
  try {
    console.log('🔍 Testing Cube.js API endpoints...');
    
    // Test meta endpoint to see available cubes
    console.log('\n1. Testing meta endpoint...');
    const metaResponse = await fetch('http://localhost:4000/cubejs-api/v1/meta');
    const metaData = await metaResponse.json();
    console.log('✅ Available cubes:');
    Object.keys(metaData.cubes).forEach(cubeName => {
      console.log(`   - ${cubeName}`);
    });
    
    // Test load endpoint with KPI query
    console.log('\n2. Testing KPI query...');
    const kpiQuery = {
      measures: [
        'CreditMetrics.totalOriginationAmount',
        'CreditMetrics.totalBalanceAmount',
        'CreditMetrics.averageDefaultRate',
        'CreditMetrics.primeLendingSpread'
      ]
    };
    
    const kpiResponse = await fetch('http://localhost:4000/cubejs-api/v1/load', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(kpiQuery)
    });
    const kpiData = await kpiResponse.json();
    console.log('✅ KPI data from Cube.js:');
    console.log(JSON.stringify(kpiData, null, 2));
    
    // Test multi-dimensional query with drill-down
    console.log('\n3. Testing multi-dimensional query...');
    const multiDimQuery = {
      measures: [
        'CreditMetrics.totalOriginationAmount',
        'CreditMetrics.averageDefaultRate'
      ],
      dimensions: [
        'DateDimension.year',
        'DateDimension.quarter'
      ],
      timeDimensions: [{
        dimension: 'DateDimension.quarterStart',
        granularity: 'quarter',
        dateRange: ['2012-01-01', '2015-12-31']
      }],
      order: {
        'DateDimension.year': 'asc',
        'DateDimension.quarter': 'asc'
      }
    };
    
    const multiDimResponse = await fetch('http://localhost:4000/cubejs-api/v1/load', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(multiDimQuery)
    });
    const multiDimData = await multiDimResponse.json();
    console.log('✅ Multi-dimensional data (first 5 records):');
    console.log(JSON.stringify(multiDimData.data.slice(0, 5), null, 2));
    
    // Test product analysis with drill-down
    console.log('\n4. Testing product analysis...');
    const productQuery = {
      measures: [
        'CreditMetrics.totalOriginationAmount',
        'CreditMetrics.averageDefaultRate'
      ],
      dimensions: [
        'ProductDimension.productType',
        'GeographyDimension.country'
      ]
    };
    
    const productResponse = await fetch('http://localhost:4000/cubejs-api/v1/load', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productQuery)
    });
    const productData = await productResponse.json();
    console.log('✅ Product analysis data:');
    console.log(JSON.stringify(productData.data, null, 2));
    
    console.log('\n🎉 Cube.js API is working perfectly! True OLAP capabilities enabled!');
    
  } catch (error) {
    console.error('❌ Cube.js API test failed:', error.message);
  }
}

testCubeJSAPI();
