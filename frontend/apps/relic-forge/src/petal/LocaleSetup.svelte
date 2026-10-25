<script lang="ts">
 import { language } from './i18n';
 $effect(()=>{
  const code=language();
  document.documentElement.lang=code;
  document.documentElement.dir=code==='ar'?'rtl':'ltr';
 });
</script>
