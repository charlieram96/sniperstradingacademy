// Script to add test members - Run this in the browser console while on the team page
// Make sure you're logged in first!

async function addTestMembers() {
  try {
    console.log('🚀 Starting to add test members...');
    
    const response = await fetch('/api/test/add-members', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success! Added test members:');
      console.log(`   Level 1: ${data.summary.level1} members`);
      console.log(`   Level 2: ${data.summary.level2} members`);
      console.log(`   Level 3: ${data.summary.level3} members`);
      console.log(`   Level 4: ${data.summary.level4} members`);
      console.log(`   Total: ${data.summary.total} members`);
      console.log('');
      console.log('🔄 Refreshing page to show new members...');
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      console.error('❌ Error:', data.error || 'Failed to add test members');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
addTestMembers();