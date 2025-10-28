<script setup>
    import { computed, reactive } from 'vue'
    import setIcons from '../setIcons.json'

    const props = defineProps({
        setCode: {
            type: String,
            required: true
        }
    })

    const setConfig = reactive(setIcons.data)

    const config = computed(() => {

        let set = setConfig.filter(e => e.code == props.setCode?.toLowerCase())

        if (set.length > 0) {
            return {
                id: set[0].id,
                icon_svg_uri: set[0].icon_svg_uri
            }
        } else {
            return {
                id: null,
                icon_svg_uri: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/MTG_%28PW%29.svg'
            }
        }
    })

    const setURI = computed(() => config.value.icon_svg_uri)

</script>

<template>
    <img :src="setURI" class="set">
</template>

<style scoped>
    .set {
        width: 1.5em;
        height: 1.5em;
    }
</style>
