// Test script to verify Claude integration works
const API_URL = 'http://localhost:8787';

async function testClaudeIntegration() {
  console.log('🧪 Testing Claude Integration...\n');
  
  // Test data with email validation
  const testData = [
    { id: 1, name: 'John Doe', email: 'john@example.com', phone: '555-1234' },
    { id: 2, name: 'Jane Smith', email: 'invalid-email', phone: '555-5678' },
    { id: 3, name: 'Bob Johnson', email: 'bob.johnson@company.co.uk', phone: 'not-a-phone' },
  ];

  try {
    // 1. Create a task
    console.log('📤 Creating email validation task...');
    const createResponse = await fetch(`${API_URL}/api/tasks/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Validate the email addresses in this data. Check if they are properly formatted email addresses.',
        selectedRows: [0, 1, 2],
        selectedColumns: ['email'],
        data: testData
      })
    });
    
    if (!createResponse.ok) {
      throw new Error(`Failed to create task: ${createResponse.status}`);
    }
    
    const createData = await createResponse.json();
    console.log('✅ Task created:', {
      taskId: createData.taskId,
      status: createData.status,
      message: createData.message
    });
    
    const taskId = createData.taskId;
    
    // 2. Poll for completion
    console.log('\n⏳ Waiting for analysis...');
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      const statusResponse = await fetch(`${API_URL}/api/tasks/${taskId}`);
      const statusData = await statusResponse.json();
      
      console.log(`Attempt ${attempts}: Status = ${statusData.status}`);
      
      if (statusData.status === 'completed') {
        console.log('\n🎉 Analysis completed!');
        console.log('\n📊 Results:');
        console.log('Analysis method:', statusData.result.method);
        console.log('\nAnalysis:');
        console.log(statusData.result.analysis);
        
        if (statusData.result.validations) {
          console.log('\n🔍 Validations found:');
          statusData.result.validations.forEach((validation, index) => {
            console.log(`${index + 1}. Row ${validation.rowIndex}, ${validation.columnId}: ${validation.status}`);
            console.log(`   Original: ${validation.originalValue}`);
            if (validation.suggestedValue) {
              console.log(`   Suggested: ${validation.suggestedValue}`);
            }
            console.log(`   Reason: ${validation.reason}\n`);
          });
        }
        break;
      } else if (statusData.status === 'failed') {
        console.log('\n❌ Analysis failed:');
        console.log(statusData.error);
        break;
      }
    }
    
    if (attempts >= maxAttempts) {
      console.log('\n⏰ Timeout waiting for analysis to complete');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testClaudeIntegration();