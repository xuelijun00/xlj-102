<template>
  <div class="app">
    <Login v-if="!isLoggedIn" @login="handleLogin" />
    <Layout v-else :user="user" @logout="handleLogout" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Login from './components/Login.vue'
import Layout from './components/Layout.vue'
import { authAPI } from './utils/api'

const isLoggedIn = ref(false)
const user = ref(null)

const handleLogin = (loginUser) => {
  user.value = loginUser
  isLoggedIn.value = true
}

const handleLogout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  isLoggedIn.value = false
  user.value = null
  window.location.reload()
}

onMounted(async () => {
  const storedToken = localStorage.getItem('token')
  const storedUser = localStorage.getItem('user')
  if (storedToken && storedUser) {
    try {
      const res = await authAPI.getMe()
      user.value = res.data
      isLoggedIn.value = true
    } catch {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app {
  min-height: 100vh;
}
</style>
