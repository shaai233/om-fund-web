import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/base.css'

function preventPinchZoom (event: TouchEvent) {
  if (event.touches.length > 1) event.preventDefault()
}

function preventGestureZoom (event: Event) {
  event.preventDefault()
}

document.addEventListener('touchmove', preventPinchZoom, { passive: false })
document.addEventListener('gesturestart', preventGestureZoom, { passive: false })
document.addEventListener('gesturechange', preventGestureZoom, { passive: false })
document.addEventListener('gestureend', preventGestureZoom, { passive: false })

createApp(App).use(router).mount('#app')
